require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());

const S     = JSON.parse(fs.readFileSync('selectors.json'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
  const page    = await browser.newPage();

  /* ──── PlanHub ──── */
  await page.setCookie(...require('../../planhub_cookies.json'));
  await page.goto(
    'https://subcontractor.planhub.com/leads/list?type=planhub',
    { waitUntil: 'domcontentloaded' }
  );
  await page.waitForSelector('planhub-lead-item', { timeout: 90_000 });

  for (const [k, sel] of Object.entries(S.planhub))
    console.log('PlanHub', k, '→', !!(await page.$(sel)));

  /* ──── BC: Bid Board ──── */
  await page.setCookie(...require('../../buildingconnected_cookies.json'));
  await page.goto(
    'https://app.buildingconnected.com/opportunities/pipeline',
    { waitUntil: 'domcontentloaded' }
  );

  /* ждём первую строку списка */
  await page.waitForSelector(S.bc_list.project_click, { timeout: 90_000 });
  await page.waitForSelector(S.bc_list.name,  { timeout: 90_000 }).catch(() => {});
  await page.waitForSelector(S.bc_list.date,  { timeout: 90_000 }).catch(() => {});

  for (const [k, sel] of Object.entries(S.bc_list))
    if (k !== 'project_click')
      console.log('BC‑list', k, '→', !!(await page.$(sel)));

  /* ── внутрь opportunity ── */
  await Promise.all([
    page.waitForSelector(S.bc_contact.open_modal, { timeout: 90_000 }),
    page.click(S.bc_list.project_click)
  ]);

  /* ── модалка контакта ── */
  await page.click(S.bc_contact.open_modal);
  await page.waitForSelector(S.bc_contact.name, { timeout: 90_000 });

  for (const [k, sel] of Object.entries(S.bc_contact))
    if (k !== 'open_modal')
      console.log('BC‑modal', k, '→', !!(await page.$(sel)));

  await browser.close();
})();
