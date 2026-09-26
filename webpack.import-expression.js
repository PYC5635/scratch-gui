/*
 * webpack 4 only understands the legacy acorn representation of dynamic import,
 * where `import("x")` is a CallExpression whose callee is an `Import` node. The
 * acorn build that ends up in node_modules here reports version 6.4.2 but ships
 * acorn 8 code, which emits an `ImportExpression` node instead. webpack's
 * walkExpression() has no case for that node type and no default branch, so every
 * dynamic import was silently skipped: no async chunk was created and the raw
 * `import(...)` text was emitted into the bundle, breaking both code splitting
 * and the addon loader at runtime.
 *
 * Normalising the node back into the shape webpack expects restores code
 * splitting without touching node_modules or the installed acorn.
 */
const toLegacyCall = expression => ({
    type: 'CallExpression',
    callee: {type: 'Import'},
    arguments: [expression.source],
    range: expression.range,
    loc: expression.loc
});

class ImportExpressionCompatPlugin {
    apply(compiler) {
        compiler.hooks.compilation.tap('ImportExpressionCompatPlugin', (compilation, {normalModuleFactory}) => {
            const patchParser = parser => {
                const walkExpression = parser.walkExpression;
                parser.walkExpression = function (expression) {
                    if (expression && expression.type === 'ImportExpression') {
                        const asCall = toLegacyCall(expression);
                        if (this.hooks.importCall.call(asCall) === true) return;
                        if (expression.source) this.walkExpression(expression.source);
                        return;
                    }
                    return walkExpression.call(this, expression);
                };
            };
            for (const type of ['javascript/auto', 'javascript/dynamic', 'javascript/esm']) {
                normalModuleFactory.hooks.parser.for(type).tap('ImportExpressionCompatPlugin', patchParser);
            }
        });
    }
}

module.exports = ImportExpressionCompatPlugin;