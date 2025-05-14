// --- системные модули ---------------------------------
const fs   = require('fs');
const os   = require('os');
const path = require('path');


// --- фикс для production ---------------------------------
if (!process.defaultApp) {
  const { resourcesPath } = process;          // …/PlanHub Scraper-win32-x64/resources

  // варианты, которые могут существовать в зависимости от asar/asar.unpacked
  const pathsToTry = [
    path.join(resourcesPath, 'app.asar',           'node_modules'),
    path.join(resourcesPath, 'app.asar.unpacked',  'node_modules'),
    path.join(resourcesPath, 'app',                'node_modules')
  ];

  const Module = require('module');
  pathsToTry.forEach(p => Module.globalPaths.includes(p) || Module.globalPaths.push(p));
}


// --- electron -----------------------------------------
const { app, BrowserWindow, ipcMain } = require('electron');

const COOKIE_PATH = path.join(app.getPath('userData'), 'planhub_cookies.json');


const earlyLogPath = path.join(os.homedir(), 'Desktop', 'early-log.txt');
fs.writeFileSync(earlyLogPath, `Script started at ${new Date().toISOString()}\n`, {flag: 'w'});

const scrapePlanhub = require('./planhub/scrape_planhub_basic');

const logPath = path.join(app.getPath('desktop'), 'electron-log.txt');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function log(msg) {
  logStream.write(`${new Date().toISOString()} - ${msg}\n`);
}

// Логируем все ошибки
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.stack}`);
});
process.on('unhandledRejection', (reason, p) => {
  log(`Unhandled Rejection: ${reason}`);
});

log('App started');


function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      /** plugin-webpack подставит правильный путь сам */
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  /** эта константа – URL (http://… в dev, file://… в prod) */
  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(err => {
    log(`[Electron] Cannot load renderer: ${err}`);
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.on('ready-to-show', () => log('[Electron] Window is ready to show.'));
  win.on('closed', () => log('[Electron] Window was closed.'));
}

app.whenReady().then(() => {
  log('[Electron] App ready event triggered.');
  createWindow();
}).catch((error) => {
  log(`[Electron] App failed to initialize: ${error.message}`);
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Проверка куков при запуске программы
ipcMain.on('check-cookies', (event) => {
  const hasCookies =
    fs.existsSync(COOKIE_PATH) &&
    fs.readFileSync(COOKIE_PATH, 'utf8').trim() !== '[]';
  event.sender.send('cookies-status', hasCookies);
});




ipcMain.on('upload-cookies', (event, cookies) => {
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  event.sender.send('scrape-log', 'Cookies saved successfully');
});



/* IPC интеграция реального скрапинга с логами и результатами */
ipcMain.on('start-scraping', async (event) => {
  const win = BrowserWindow.getFocusedWindow();
  const sendLog = (msg) => win.webContents.send('scrape-log', msg);

  const cookiePath = COOKIE_PATH;

  sendLog('Checking for cookies...');

  if (!fs.existsSync(COOKIE_PATH) ||
		fs.readFileSync(COOKIE_PATH, 'utf8').trim() === '[]') {
	  sendLog('❌ Cookies not found. Please upload fresh cookies.');
	  win.webContents.send('cookies-status', false);
	  return;
	}


	win.webContents.send('cookies-status', true);
	sendLog('✅ Cookies found, launching browser...');


  try {
    const { rows, csv } = await scrapePlanhub({
      headless: true,
      logger: sendLog  // передаём sendLog в скрипт парсинга
    });

    sendLog(`✅ Scraping completed! Results found: ${rows.length}`);
    win.webContents.send('scrape-results', rows);

    const outputPath = path.join(app.getPath('desktop'), 'scraping_results.csv');
    fs.writeFileSync(outputPath, csv);
    sendLog(`✅ CSV file saved to: ${outputPath}`);

  } catch (error) {
    sendLog(`❌ Error: ${error.message}`);
    console.error('Scraping Error:', error);
  }
});



