import path from 'path'
// import type { Configuration } from 'webpack'

const POI_PATH = process.env.POI_PATH || path.resolve('..', 'poi')

const webpackConfig = {
  mode: 'development',
  entry: './explorer/main.es',
  devtool: 'eval-cheap-module-source-map',
  output: {
    filename: 'main.js',
  },
  module: {
    rules: [
      {
        test: /\.es$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  plugins: [],
  resolve: {
    modules: ['node_modules', path.resolve(POI_PATH, 'node_modules')],
    alias: {
      electron: false,
      path: false,
      url: false,
      'fs-extra': false,
      'path-extra': false,
      views: path.resolve(POI_PATH, 'views'),
    },
    extensions: ['.ts', '.tsx', '.es', '.js', '.jsx', '.json'],
  },
  devServer: {
    open: true,
    openPage: 'explorer',
    contentBase: [path.resolve('./'), path.resolve(POI_PATH, 'node_modules')],
  },
  performance: {
    hints: false,
  },
}

export default webpackConfig
