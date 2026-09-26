/* Production build for the pinewarp.github.io deployment.
 *
 * webpack.config.js exports two configs: the browser app (output: build/) and a
 * UMD library bundle (output: dist/). The deployment only ships the former, so
 * skip the library build entirely - it costs a lot of compile time and RAM.
 */
const path = require('path');

const configs = require('./webpack.config.js');
const distPath = path.resolve(__dirname, 'dist');

module.exports = configs.filter(config => config.output.path !== distPath);