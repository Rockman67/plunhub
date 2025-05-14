/* ──────────────────────────────────────────────────────────────
   utils/puppeteer.js
   Универсальный «лаунчер»:
     • если есть BROWSERLESS_TOKEN → подключаемся к Browserless
       (без Stealth – иначе он ломает сессии).
     • иначе — локальный Chrome с puppeteer-extra + Stealth.
   Поддерживается HTTP-proxy (Bright Data).
   2025-05-10 — v4
   ───────────────────────────────────────────────────────────── */

require('dotenv').config();
const path = require('path');

/* ─── LOCAL Chrome (Stealth) ──────────────────────────────── */
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin  = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

function buildArgs() {
  const args = ['--no-sandbox', '--disable-setuid-sandbox'];
  const { PROXY_HOST, PROXY_PORT } = process.env;

  if (PROXY_HOST && PROXY_PORT) {
    args.push(`--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`);
    args.push('--ignore-certificate-errors');
  }
  return args;
}

function launchLocal(opts = {}) {
  console.log('[BL] LOCAL Chrome (Stealth)');
  return puppeteerExtra.launch({
    headless      : 'new',
    args          : buildArgs(),
    userDataDir   : path.resolve(__dirname, '../../chrome_profile'),
    protocolTimeout: 180_000,
    ...opts
  });
}

/* ─── Browserless cloud (без Stealth) ─────────────────────── */
const puppeteerCore = require('puppeteer-core');

function buildWsEndpoint() {
  const { BROWSERLESS_TOKEN,
          PROXY_HOST, PROXY_PORT,
          PROXY_USER = '', PROXY_PASS = '' } = process.env;

  if (!BROWSERLESS_TOKEN)
    throw new Error('BROWSERLESS_TOKEN is not set in .env');

  let qs = `token=${BROWSERLESS_TOKEN}`;
  qs += '&timeout=0';
  qs += '&window=true&overlay=true';

  if (PROXY_HOST && PROXY_PORT) {
    qs += `&proxy.url=http://${PROXY_HOST}:${PROXY_PORT}`;
    if (PROXY_USER) qs += `&proxy.username=${encodeURIComponent(PROXY_USER)}`;
    if (PROXY_PASS) qs += `&proxy.password=${encodeURIComponent(PROXY_PASS)}`;
  }
  return `wss://chrome.browserless.io?${qs}`;
}

function connectRemote(opts = {}) {
  const ws = buildWsEndpoint();
  console.log('[BL] connected to Browserless');
  console.log('[BL] ws endpoint →', ws.split('&')[0] + '&…');

  return puppeteerCore.connect({
    browserWSEndpoint: ws,
    ignoreHTTPSErrors : true,
    protocolTimeout   : 180_000,
    ...opts
  });
}

/* ─── EXPORT ──────────────────────────────────────────────── */
exports.launch = (opts = {}) =>
  process.env.BROWSERLESS_TOKEN ? connectRemote(opts)
                                : launchLocal(opts);
