// webpack.main.config.js
const path = require('path');

module.exports = {
  // одна точка входа — главный процесс
  entry : './src/main.js',
  target: 'electron-main',

  output: {
    // куда Forge-плагин кладёт скомпилированный Main
    path    : path.resolve(__dirname, '.webpack/main'),
    filename: 'index.js'                // обязательно index.js
  },

  node: {
    __dirname : false,
    __filename: false
  },

  resolve: {
    extensions: ['.js', '.json'],
    alias     : {
      // оставляем только реально ненужный пакет
      'unsupported': false
    }
  },

  /* webpack не пихает тяжёлые пакеты внутрь bundle,
     а Forge позже копирует их в node_modules */
  externals: {
    'puppeteer'                        : 'commonjs puppeteer',
    'puppeteer-core'                   : 'commonjs puppeteer-core',
    'puppeteer-extra'                  : 'commonjs puppeteer-extra',
    'puppeteer-extra-plugin-stealth'   : 'commonjs puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin-recaptcha' : 'commonjs puppeteer-extra-plugin-recaptcha',
    'fs-extra'                         : 'commonjs fs-extra'
  },

  module: {
    rules: [
      {
        test   : /\.js$/,
        exclude: /node_modules/,
        use    : {
          loader : 'babel-loader',
          options: { presets: ['@babel/preset-env'] }
        }
      }
    ]
  }
};
