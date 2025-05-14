// webpack.renderer.config.js
// ⚠  entry / output / target задаёт @electron-forge/plugin-webpack, здесь только
// ⚠  loaders и resolve.

module.exports = {
  module: {
    rules: [
      /* --- JSX / JS -------------------------------------------------- */
      {
        test: /\.(jsx?|mjs)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            /*  ▼▼▼  главное изменение  ▼▼▼
                Включаем новый «автоматический» runtime,
                поэтому импорт React в каждом файле больше не нужен. */
            presets: [
              ['@babel/preset-env',   { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },

      /* --- CSS ------------------------------------------------------- */
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
};
