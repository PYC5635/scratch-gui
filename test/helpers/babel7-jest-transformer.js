/**
 * babel-jest@21 hard-codes a dependency on babel-core 6, but this project's
 * .babelrc uses babel 7 plugins/presets (@babel/preset-env, ...). That mismatch
 * makes jest 21 unusable with the stock transformer.
 *
 * This transformer bridges the gap by running @babel/core 7 directly, reading
 * the project's .babelrc the same way babel-loader does during the webpack
 * build, so tests and app code are transpiled consistently.
 */
const babel = require('@babel/core');
const crypto = require('crypto');

module.exports = {
    process (src, filename) {
        const result = babel.transformSync(src, {
            filename: filename,
            babelrc: true
        });
        return {code: result.code, map: result.map || null};
    },
    getCacheKey (fileData, filename) {
        return crypto
            .createHash('md5')
            .update(fileData)
            .update(filename)
            .digest('hex');
    }
};
