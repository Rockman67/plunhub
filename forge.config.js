/* forge.config.js */
console.log('⚙️  Forge config LOADED FROM:', __filename);

const path            = require('path');
const fs              = require('fs-extra');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

/* Каталог, куда Forge кладёт .exe / .zip и т.п. */
const OUT_DIR = path.resolve('C:/builds/electron');

module.exports = {
  /* ---------- packager ---------- */
  packagerConfig: {
    out  : OUT_DIR,       // ← один-единственный источник правды
    prune: false,

    /* Chrome + puppeteer лежат вне asar, чтобы могли писать профили */
    asar : {
      unpackDir:
        'node_modules/{puppeteer,puppeteer-core,puppeteer-extra,' +
        'puppeteer-extra-plugin-*,fs-extra}/**'
    },

    /* afterCopy копирует нужные модули рядом с приложением */
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
              !/[/\\]\.cache[/\\]/i.test(p)            // и кэши
          });
        }
        console.log('[afterCopy] ✓ modules copied');
      }
    ]
  },

  /* ---------- makers (важно для .exe) ---------- */
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} }, // ← Windows installer
    { name: '@electron-forge/maker-zip',      platforms: ['darwin'] },
    { name: '@electron-forge/maker-deb',      config: {} },
    { name: '@electron-forge/maker-rpm',      config: {} }
  ],

  /* ---------- plugins ---------- */
  plugins: [
    {
      name  : '@electron-forge/plugin-webpack',
      config: {
        /* webpack конфиги */
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

        /* модули, которые НЕ должны упаковываться в asar */
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

    /* ---------- Electron Fuses ---------- */
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]                            : false,
      [FuseV1Options.EnableCookieEncryption]               : true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]                  : true
    })
  ]
};

console.log('⚙️  packagerConfig.out =', OUT_DIR);
