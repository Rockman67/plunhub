/* forge.config.js */
console.log('⚙️  Forge config LOADED FROM:', __filename);

const path            = require('path');
const fs              = require('fs-extra');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  /* ------------------------------------------------------------------ */
  /* 1.  Packager                                                       */
  /* ------------------------------------------------------------------ */
  packagerConfig: {
    prune: false,
    asar : {
      unpackDir:
        'node_modules/{puppeteer,puppeteer-core,puppeteer-extra,' +
        'puppeteer-extra-plugin-*,fs-extra}/**'
    },
    /* кладём «тяжёлые» зависимости рядом с приложением */
    afterCopy: [
      async (buildPath) => {
        const deps = [
          'puppeteer',
          'puppeteer-core',
          'puppeteer-extra',
          'puppeteer-extra-plugin-stealth',
          'puppeteer-extra-plugin-recaptcha',
          'fs-extra'
        ];

        for (const dep of deps) {
          const src = path.join(__dirname, 'node_modules', dep);
          const dst = path.join(buildPath,  'node_modules', dep);

          console.log(`[afterCopy] → ${dep}`);
          await fs.copy(src, dst, {
            recursive: true,
            filter: (p) =>
              !/[/\\]local-chromium[/\\]/i.test(p) &&  // не тащим Chromium
              !/[/\\]\.cache[/\\]/i.test(p)
          });
        }
        console.log('[afterCopy] ✓ modules copied');
      }
    ]
  },

  /* ------------------------------------------------------------------ */
  /* 2.  Makers – только они нужны Forge’у, никаких make_targets!       */
  /* ------------------------------------------------------------------ */
  makers: [
    {
      name     : '@electron-forge/maker-squirrel',
      /* запускаем **только** на Windows-раннере */
      platforms: ['win32'],
      config   : {
        name: 'planhub_scraper',
        setupIcon:    'assets/icon.ico',
        setupExe:     'PlanHubScraperSetup.exe',
        setupMsi:     'PlanHubScraperSetup.msi'
      }
    },
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb', config: {} },
    { name: '@electron-forge/maker-rpm', config: {} }
  ],

  /* ------------------------------------------------------------------ */
  /* 3.  Web-pack плагин                                                */
  /* ------------------------------------------------------------------ */
  plugins: [
    {
      name  : '@electron-forge/plugin-webpack',
      config: {
        mainConfig: path.resolve(__dirname, 'webpack.main.config.js'),
        renderer  : {
          config: path.resolve(__dirname, 'webpack.renderer.config.js'),
          entryPoints: [
            {
              html   : './renderer/index.html',
              js     : './renderer/src/main.jsx',
              name   : 'main_window',
              preload: { js: './src/preload.js' }
            }
          ],
          devServer: { enabled: true, port: 5173 }
        },

        externals: {
          main: [
            'puppeteer',
            'puppeteer-core',
            'puppeteer-extra',
            'puppeteer-extra-plugin-stealth',
            'puppeteer-extra-plugin-recaptcha',
            'fs-extra',
            'unsupported'
          ]
        },

        mainEntryPoint   : './src/main.js',
        preloadEntryPoint: './src/preload.js'
      }
    },

    /* Fuses-плагин без изменений */
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]                            : false,
      [FuseV1Options.EnableCookieEncryption]               : true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]                  : true
    })
  ]
};
