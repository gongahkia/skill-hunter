const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'inline-source-map',
    entry: {
      popup: './src/popup.ts',
      content: './src/content.ts',
      background: './src/background.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      }),
      new CopyPlugin({
        patterns: [
          { 
            from: 'src/manifest.json', 
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              // Update script references in manifest
              if (manifest.content_scripts) {
                manifest.content_scripts.forEach(script => {
                  if (script.js) {
                    script.js = script.js.map(file => 
                      file.replace('main.js', 'content.js')
                    );
                  }
                });
              }
              if (manifest.action && manifest.action.default_popup) {
                manifest.action.default_popup = manifest.action.default_popup.replace('popup.html', 'popup.html');
              }
              return JSON.stringify(manifest, null, 2);
            }
          },
          { from: 'src/popup.html', to: 'popup.html' },
          { from: 'src/local_asset', to: 'local_asset' },
          { from: 'src/styles', to: 'styles', noErrorOnMissing: true }
        ]
      })
    ],
    optimization: {
      minimize: isProduction
    }
  };
};

