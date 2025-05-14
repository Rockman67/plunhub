/* forge.config.js */
console.log('⚙️  Forge config LOADED FROM:', __filename);

const path            = require('path');
const fs              = require('fs-extra');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

/* ---------- конфигурация ---------- */
module.exports = {
  /* -------------------------------------------------------------------- */
  /* 1)  Явно указываем maker-цели (ключевой фикс)                        */
  /* -------------------------------------------------------------------- */
  make_targets: {
    win32: ['@electron-forge/maker-squirrel'],   // ← главное!
    linux: ['@electron-forge/maker-deb', '@electron-forge/maker-rpm'],
    darwin: ['@electron-forge/maker-zip']
  },

  /* -------------------------------------------------------------------- */
  /* 2)  Packager                                                         */
  /* -------------------------------------------------------------------- */
  packagerConfig: {
    prune: false,
    asar : {
      unpackDir:
        'node_modules/{puppeteer,puppeteer-core,puppeteer-extra,' +
        'puppeteer-extra-plugin-*,fs-extra}/**'
    },
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
              !/[/\\]local-chromium[/\\]/i.test(p) &&
              !/[/\\]\.cache[/\\]/i.test(p)
          });
        }
        console.log('[afterCopy] ✓ modules copied');
      }
    ]
  },

  /* -------------------------------------------------------------------- */
  /* 3)  Makers                                                           */
  /* -------------------------------------------------------------------- */
  makers: [
    {
      /* Windows-инсталлятор (Squirrel) */
      name : '@electron-forge/maker-squirrel',
      config: { name: 'planhub_scraper' }
    },
    { name: '@electron-forge/maker-zip',  platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb',  config: {} },
    { name: '@electron-forge/maker-rpm',  config: {} }
  ],

  /* -------------------------------------------------------------------- */
  /* 4)  Webpack-плагин                                                   */
  /* -------------------------------------------------------------------- */
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

    /* Fuses-плагин */
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]                            : false,
      [FuseV1Options.EnableCookieEncryption]               : true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]                  : true
    })
  ]
};
