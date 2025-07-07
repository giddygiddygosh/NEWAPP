// craco.config.js

const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      webpackConfig.entry = {
        main: paths.appIndexJs,
        formEmbed: './src/embed.js',
      };

      webpackConfig.output = {
        ...webpackConfig.output,
        filename: (pathData) => {
          if (pathData.chunk.name === 'formEmbed') {
            return 'static/js/form-embed.js';
          }
          return 'static/js/[name].[contenthash:8].js';
        },
        publicPath: process.env.PUBLIC_URL || '/',
      };
      
      return webpackConfig;
    },
  },
};