/* ──────────────────────────────────────────────────────────────
   src/planhub/scrape_planhub_basic.js
   2025-05-09 — v19
   ────────────────────────────────────────────────────────────── */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { launch } = require('../utils/puppeteer');

/* Browserless keep-alive */
if (process.env.BROWSERLESS_TOKEN &&
    !process.env.PUPPETEER_WS_ENDPOINT_KEEPALIVE) {
  process.env.PUPPETEER_WS_ENDPOINT_KEEPALIVE = 'true';
}

/* ─── конфигурация ─────────────────────────────────────────── */
const COOKIE_PATH = path.resolve(__dirname, '../../planhub_cookies.json');
const LIST_URL    = 'https://subcontractor.planhub.com/leads/list?type=planhub';
const ORIGIN      = new URL(LIST_URL).origin;
const SIGNIN_URL  = 'https://access.planhub.com/signin';
const APP_URL     = 'https://app.planhub.com/';

/* лимит строк (--limit 25) */
const NEED_ROWS = (() => {
  const i = process.argv.indexOf('--limit');
  return (i !== -1 && process.argv[i + 1])
         ? Math.max(+process.argv[i + 1], 1)
         : Number.MAX_SAFE_INTEGER;
})();

/* селекторы из общего JSON */
const S = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../selectors.json'), 'utf8')
);

/* helpers */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const clean = v=>(v && typeof v==='string' && v.trim() && v!=='–')?v.trim():'—';

/* proxy auth */
async function setProxyAuth(page){
  const { PROXY_USER='', PROXY_PASS='' } = process.env;
  if (PROXY_USER){
    try{ await page.authenticate({username:PROXY_USER,password:PROXY_PASS}); }catch{}
  }
}

/* выводим URL каждые 10 с, пока не появится selector */
async function waitPing(page, label, selector, timeout = 240_000, logger = console.log) {
  const start = Date.now();
  while (true) {
    const url = page.url();

    if (url.includes('/signin')) {
      logger(`[WAIT-PING] Detected signin while waiting for «${label}». Trying autoLogin…`);
      const ok = await autoLogin(page); 
      if (!ok) {
        await sleep(5000);
        continue;
      }
    }

    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      return;
    } catch {
      const t = ((Date.now() - start) / 1000).toFixed(1);
      logger(`[WAIT] ${label} — ${t}s (${url})`);

      if (Date.now() - start > timeout) {
        throw new Error(`[WAIT] timeout ${label}`);
      }
    }
    await sleep(500);
  }
}




/* ждём любой из селекторов */
async function waitAny(page,sels,timeout=30_000){
  const start = Date.now();
  while(Date.now()-start < timeout){
    for(const s of sels)
      if(await page.$(s).then(Boolean).catch(()=>false)) return s;
    await sleep(350);
  }
  return null;
}

/* аккуратный ввод */
async function safeType(page,sels,txt){
  for(const s of sels){
    try{
      const el=await page.waitForSelector(s,{timeout:3_500});
      await el.click({clickCount:3});
      await page.keyboard.press('Backspace');
      await page.type(s,txt,{delay:40});
      return true;
    }catch{}
  }
  return false;
}

/* редирект app.planhub → signin */
async function resolveLanding(page){
  if(!page.url().startsWith(APP_URL)) return;

  const link = await waitAny(page,['a[href*="/signin"]','button[href*="/signin"]'],8_000);
  if(link)
    await Promise.allSettled([
      page.click(link),
      page.waitForNavigation({waitUntil:'domcontentloaded',timeout:60_000}).catch(()=>{})
    ]);
  else
    await page.goto(SIGNIN_URL,{waitUntil:'domcontentloaded'}).catch(()=>{});
}

/* auto-login */
async function autoLogin(page){
  console.log('[LOGIN] auto-login …');

  const EMAIL=['input[qa-locator="input-username"]','input[name="username"]',
               'input[type="email"]','input#mat-input-0'];
  const PASS =['input[qa-locator="input-password"]','input[name="password"]',
               'input[type="password"]','input#mat-input-1'];
  const BTN  =['button#sign-in-button','button[qa-locator="button-sign-in-to-planhub"]',
               'button[type="submit"]'];

  if(!await waitAny(page,EMAIL,45_000))                  return false;
  if(!await safeType(page,EMAIL,process.env.PH_USER))    return false;
  if(!await safeType(page,PASS ,process.env.PH_PASS))    return false;

  for(const b of BTN)
    if(await page.$(b).then(Boolean).catch(()=>false)){
      await Promise.allSettled([
        page.click(b),
        page.waitForNavigation({waitUntil:'domcontentloaded',timeout:150_000}).catch(()=>{})
      ]);
      break;
    }

  try{
    await page.waitForFunction(u=>location.href.startsWith(u),{timeout:150_000},LIST_URL);
  }catch{}
  const ok = page.url().startsWith(LIST_URL);
  console.log(ok ? '  ✓ signed in' : '  ✗ still on signin');
  return ok;
}

// ─── реагируем на любые переходы главного фрейма ──────────────
function attachLoginWatcher(page){
  page.on('framenavigated', async frame => {
    // интересен только главный фрейм
    if (frame !== page.mainFrame()) return;

    const url = frame.url();
    // Если внезапно оказались на странице логина — логинимся снова
    if (url.startsWith(SIGNIN_URL)) {
      console.log(`[WATCHER] Redirected to signin (${url}). Re-logging in…`);
      try {
        await ensureLoggedIn(page);
        console.log('[WATCHER] Re-login successful.');
      } catch (e) {
        console.error('[WATCHER] Re-login failed:', e.message);
      }
    }
  });
}




/* ensureLoggedIn */
async function ensureLoggedIn(page) {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  if (!page.url().startsWith(LIST_URL)) {
    throw new Error('Требуется загрузить свежие куки через интерфейс!');
  }
}





/* GC-карточки */
async function extractGC(page){
  await page.waitForSelector('planhub-project-general-contractor-card',{timeout:45_000});
  return page.$$eval('planhub-project-general-contractor-card',cards=>
    cards.map(c=>{
      const q=s=>c.querySelector(s)?.innerText.trim()||'';
      return {
        company:q('.company-name')||'—',
        person :q('.company-name+div').replace(/^person_outline\s*/,''),
        phone  :c.querySelector('a[href^="tel:"]')?.innerText.trim()||'',
        email  :c.querySelector('a[href^="mailto:"]')?.innerText.trim()||''
      };
    })
  );
}

/* пагинация */
async function gotoNextPage(page){
  const NEXT='button[qa-locator^="button-lead-list-next-page"]:not(.mat-button-disabled)';
  if(!(await page.$(NEXT).then(Boolean).catch(()=>false))) return false;

  await Promise.allSettled([
    page.click(NEXT),
    page.waitForNetworkIdle({idleTime:500,timeout:90_000}).catch(()=>{}),
    page.waitForSelector('[qa-locator^="lead-list-go-to-details"]',{timeout:90_000}).catch(()=>{})
  ]);
  await sleep(800);
  return true;
}

/* ─── EXPORT MODULE ─────────────────────────────────────────────────── */
module.exports = scrapePlanhub;

/* ─── ОСНОВНАЯ ЭКСПОРТИРУЕМАЯ ФУНКЦИЯ ───────────────────────────────── */
async function scrapePlanhub({ headless = true, limit = Number.MAX_SAFE_INTEGER, logger = console.log }) {
  const browser = await launch({ headless });
  const page = await browser.newPage();
  await setProxyAuth(page);
  page.setDefaultNavigationTimeout(300_000);
  attachLoginWatcher(page);

  logger('🚀 Browser launched.');

  if (fs.existsSync(COOKIE_PATH)) {
    const ck = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
    if (ck.length) {
      await page.setCookie(...ck);
      logger('🍪 Cookies loaded.');
    }
  } else {
    logger('⚠️ No cookies found.');
  }

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  logger(`➡️ Navigated to ${LIST_URL}`);

  await ensureLoggedIn(page);
  logger('🔑 Logged in successfully.');

  if (!page.url().startsWith(LIST_URL)) {
    throw new Error('❌ not on lead-list');
  }

  await waitPing(page, 'lead list', '[qa-locator^="lead-list-go-to-details"]', 240000, logger);

  const rawRows = [];
  let globalIdx = 0;

  while (rawRows.length < limit) {
    await waitPing(page, 'rows', '[qa-locator^="lead-list-go-to-details"]', 240000, logger);
    const rows = await page.$$('[qa-locator^="lead-list-go-to-details"]');

    for (let i = 0; i < rows.length && rawRows.length < limit; i++) {
      const TAG = `[ROW ${++globalIdx}]`;
      try {
        if (globalIdx > 1) await sleep(rand(2_000, 6_000));
        await rows[i].evaluate(el => el.scrollIntoView({ block: 'center' }));

        logger(`${TAG} Processing row...`);

        const targetP = browser.waitForTarget(
          t => t.opener() === page.target() && /\/leads\/details\/\d+\/project-info/.test(t.url()),
          { timeout: 70_000 }
        );

        await rows[i].click({ delay: 30 });
        const target = await targetP;
        if (!target) throw new Error('❌ Tab not opened');

        const details = await target.page();
        await setProxyAuth(details);
        logger(`${TAG} Opened details page.`);

        const bidDate = await details.$eval('.project__bid-due-date-value', e => e.textContent.trim())
		  .catch(() => '');
		const noBidDate = !bidDate;

		const projName = await details.$eval(
		  'h1,.project__title,.project-title',e=>e.innerText.trim()
		).catch(() => `Project ${globalIdx}`);

		let city='—', state='—';
		let m=projName.match(/-\s*([^,]+),\s*([A-Z]{2})/);
		if(!m){
		  const addr=await details.$eval('.details-overview .address div:nth-child(2)',e=>e.innerText)
					.catch(()=> '');
		  m=addr.match(/^([^,]+),\s*([A-Z]{2})/);
		}
		if(m){ city=clean(m[1]); state=clean(m[2]); }

		const trades=await details.$$eval(S.planhub.tradeCategory,els=>els.map(e=>e.innerText.trim()))
					 .catch(()=>[]);
		const csi=await details.$$eval(S.planhub.csiCode, els=>els.map(e=>e.innerText.trim()))
					 .catch(()=>[]);


        const id = details.url().match(/\/leads\/details\/(\d+)\//)?.[1];
        let gcs = [];
        if (id) {
          const gcUrl = `${ORIGIN}/leads/details/${id}/general-contractors`;
          await details.goto(gcUrl, {waitUntil: 'domcontentloaded'}).catch(() => {});
          await sleep(rand(800, 1500));
          logger(`${TAG} Navigated to General Contractors tab.`);

          try {
            gcs = await extractGC(details);
            logger(`${TAG} GC cards found: ${gcs.length}`);
          } catch (e) {
            logger(`${TAG} GC cards not found.`);
          }
        }

        if (gcs.length > 0) {
		  gcs.forEach(gc => rawRows.push({
			project: projName, bidDate: bidDate || 'N/A', noBidDate, city, state,
			tradeCategory: trades.join('; '),
			csiCode: csi.join('; '),
			company: clean(gc.company), person: clean(gc.person),
			phone: gc.phone, email: gc.email
		  }));
		} else {
		  rawRows.push({
			project: projName, bidDate: bidDate || 'N/A', noBidDate, city, state,
			tradeCategory: trades.join('; '),
			csiCode: csi.join('; '),
			company: '—', person: '—', phone: '—', email: '—'
		  });
		  logger(`${TAG} No GC data, fallback row created.`);
		}


        await details.close();
        logger(`${TAG} Details page closed.`);

      } catch (e) { 
        logger(`${TAG} ERROR: ${e.message}`); 
      }
      await page.bringToFront();
    }

    if (rawRows.length < limit && !(await gotoNextPage(page))) {
      logger('[PAG] no next page – stopping');
      break;
    } else {
      logger('[PAG] Next page...');
    }
  }

  await browser.close();
  logger('✅ Browser closed.');

  const uniq = new Map();
  rawRows.forEach(r => {
    const key = `${r.project}|${r.company}|${r.email}`;
    if (!uniq.has(key)) uniq.set(key, r);
  });

  const rows = [...uniq.values()].slice(0, limit);

  const hdr = 'source,project,bidDate,noBidDate,city,state,tradeCategory,csiCode,company,person,phone,email\n';
  const csv = rows.map(r =>
	  ['PlanHub', r.project, r.bidDate, r.noBidDate, r.city, r.state, r.tradeCategory, r.csiCode, r.company, r.person, r.phone, r.email]
		.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')
  ).join('\n') + '\n';


  logger(`📄 CSV generated, total rows: ${rows.length}`);

  return { rows, csv };
}

