const webpack = require('@nativescript/webpack')
const { ContextExclusionPlugin } = require('webpack')

module.exports = (env) => {
  webpack.init(env)
  webpack.chainWebpack((config) => {
    config.plugin('ContextExclusionPlugin|test_files').use(ContextExclusionPlugin, [/\.test\.ts$/])
  })

  // Learn how to customize:
  // https://docs.nativescript.org/webpack

  return webpack.resolveConfig()
}
