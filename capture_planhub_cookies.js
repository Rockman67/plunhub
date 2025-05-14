// tools/capture_planhub_cookies.js
require('dotenv').config();
const fs        = require('fs');
const path      = require('path');
const puppeteer = require('puppeteer');

/* ─────────────────── helpers ─────────────────── */
function ts() {
  return `[${new Date().toLocaleTimeString('ru-RU', { hour12:false })}]`;
}
function log(...args) {
  console.log(ts(), ...args);
}
/* ─────────────────────────────────────────────── */

const COOKIE_PATH = path.resolve(__dirname, '../planhub_cookies.json');
const LIST_URL    = 'https://subcontractor.planhub.com/leads/list?type=planhub';

/* ── ждём реальное нажатие клавиши ──────────────────────────── */
function waitForRealKey(msg) {
  return new Promise(resolve => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let first = true;
    log(msg);

    stdin.on('data', ch => {
      log(`stdin <${JSON.stringify(ch)}> charCode=${ch.charCodeAt(0)}`);
      if (first && (ch === '\r' || ch === '\n')) {
        log('💡  Игнорируем стартовый CR/LF от команды запуска');
        first = false;
        return;
      }
      stdin.setRawMode(false);
      stdin.removeAllListeners('data');
      resolve();
    });
  });
}
/* ───────────────────────────────────────────────────────────── */

(async () => {
  log('⏳  Запускаем Chrome...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const [page] = await browser.pages();
  await page.setBypassCSP(true);

  log('➡  Открылся Chrome – войдите в PlanHub вручную.');
  log('   После логина и появления списка проектов вернитесь в терминал и нажмите ЛЮБУЮ клавишу.');

  log('🌐  Переходим на LIST_URL...');
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' }).catch(err => log('❗ page.goto error:', err.message));
  log('📍  Сейчас page.url() =', page.url());

  // каждые 2 с показываем, на каком мы URL (чтобы видеть редиректы)
  const urlTicker = setInterval(() => log('🔄  Текущий URL:', page.url()), 2_000);

  await waitForRealKey('👉  Нажмите любую клавишу, когда увидите таблицу проектов…');

  clearInterval(urlTicker);
  log('⌨️  Пользователь нажал клавишу, собираем cookies…');

  const cookies = await page.cookies();
  log('🍪  Получено cookies:', cookies.length);

  if (!cookies.length) {
    log('✗ Cookies получить не удалось.');
  } else {
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    log(`✓ Cookies сохранены в ${COOKIE_PATH}`);
  }

  await browser.close();
  log('🛑  Браузер закрыт, скрипт завершён.');
  process.exit(0);
})();
