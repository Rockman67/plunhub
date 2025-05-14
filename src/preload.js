const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startScraping: () => ipcRenderer.send('start-scraping'),
  uploadCookies: (cookies) => ipcRenderer.send('upload-cookies', cookies),
  checkCookies: () => ipcRenderer.send('check-cookies'),

  onScrapeLog: (callback) => ipcRenderer.on('scrape-log', (_, msg) => callback(msg)),
  onScrapeResults: (callback) => ipcRenderer.on('scrape-results', (_, results) => callback(results)),
  onCookiesStatus: (callback) => ipcRenderer.on('cookies-status', (_, status) => callback(status)),
});
