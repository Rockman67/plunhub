// src/planhub/login_planhub.js
// ───────────────────────────────────────────────────────────
// PLANHUB LOGIN (cookies + 3 «живых» попытки)
//
//  ┌───────────────────────────────────────────────┐
//  │ 1) пробуем cookies  →  leads/list             │
//  │ 2) если куки не годятся → до 3 попыток формы │
//  │ 3) успех = попали на subdomain *.planhub.com │
//  └───────────────────────────────────────────────┘
require('dotenv').config();
const fs               = require('fs');
const puppeteerExtra   = require('puppeteer-extra');
const StealthPlugin    = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

const { executablePath } = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ===== Константы ===== */
const COOKIE_FILE = 'planhub_cookies.json';
const APP_URL     = 'https://subcontractor.planhub.com/leads/list?type=planhub';
const SIGNIN_URL  = 'https://access.planhub.com/signin';
const WAIT_BETWEEN_ATTEMPTS = 15000;          // 15 секунд

(async () => {
  /* ── 1. Браузер ───────────────────────────────────────── */
  const browser = await puppeteerExtra.launch({
    headless: true,
    executablePath: executablePath(),   // системный Chrome
    defaultViewport: null,
    slowMo: 30,                         // «человечья» пауза
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/118.0.5993.118 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  /* ── 2. Хелпер «я в кабинете?» ────────────────────────── */
  async function inApp() {
    return page.url().includes('subcontractor.planhub.com');
  }

  /* ── 3. Попытка 0 — cookies ───────────────────────────── */
  if (fs.existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE));
    await page.setCookie(...cookies);
    console.log('🍪  Cookies injected');

    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    if (await inApp()) {
      console.log('✅  PlanHub: вошли по cookies!');
      await page.screenshot({ path: 'screenshots/planhub_cookie.png', fullPage: true });
      return console.log('✔ Скрипт закончил работу (cookies).');
    }
    console.warn('⚠️  Cookies устарели, переходим к форме входа…');
  } else {
    console.warn('⚠️  Cookie‑файл не найден, используем форму входа…');
  }

  /* ── 4. «Живая» авторизация (1 попытка) ───────────────── */
  async function liveLogin(attempt) {
    console.log(`\n🔐  /signin  (attempt ${attempt}/3)`);

    await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"]', { timeout: 45000 });

    /* —— Email —— */
    const email = await page.$('input[name="username"]');
    const { x:eX, y:eY, width:eW, height:eH } = await email.boundingBox();
    await page.mouse.move(eX + eW / 2, eY + eH / 2);
    await email.click({ clickCount: 3 });
    await page.keyboard.type(process.env.PHUB_USER, { delay: 90 });

    /* —— Password —— */
    const pass = await page.$('input[name="password"]');
    const { x:pX, y:pY, width:pW, height:pH } = await pass.boundingBox();
    await page.mouse.move(pX + pW / 2, pY + pH / 2);
    await pass.click({ clickCount: 3 });
    await page.keyboard.type(process.env.PHUB_PASS, { delay: 90 });

    /* —— Sign In —— */
    const btn  = await page.$('#sign-in-button');
    const { x:bX, y:bY, width:bW, height:bH } = await btn.boundingBox();
    await page.mouse.move(bX + bW / 2, bY + bH / 2);
    await btn.click();

    /* ждём переход на sub‑домен (старый waitForURL не поддерживается) */
    await page.waitForFunction(
      () => location.hostname.includes('subcontractor.planhub.com'),
      { timeout: 90000 }
    );

    console.log('✅  PlanHub: dashboard открыт!');
    await page.screenshot({ path: `screenshots/planhub_live_try${attempt}.png`, fullPage: true });

    /* —— сохраняем свежие cookies —— */
    const fresh = await page.cookies();
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(fresh, null, 2));
    console.log('💾  Cookies обновлены');
    return true;
  }

  /* ── 5. До трёх live‑попыток ──────────────────────────── */
  let ok = false;
  for (let i = 1; i <= 3 && !ok; i++) {
    try {
      ok = await liveLogin(i);
    } catch (err) {
      console.error(`❌  Ошибка (attempt ${i}):`, err.message);
      if (i < 3) {
        console.log(`⏳  Жду ${WAIT_BETWEEN_ATTEMPTS/1000}s перед следующей попыткой…`);
        await sleep(WAIT_BETWEEN_ATTEMPTS);
      }
    }
  }

  if (!ok) {
    console.error('\n⛔  Не удалось войти после 3 попыток.');
    await page.screenshot({ path: 'screenshots/planhub_login_failed.png' });
  } else {
    console.log('\n✔ Скрипт закончил работу (live‑login).');
  }
})();
