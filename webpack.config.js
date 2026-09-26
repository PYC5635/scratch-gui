const defaultsDeep = require('lodash.defaultsdeep');
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// Plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// PostCss
const autoprefixer = require('autoprefixer');
const postcssVars = require('postcss-simple-vars');
const postcssImport = require('postcss-import');

const STATIC_PATH = process.env.STATIC_PATH || '/static';
const {APP_NAME} = require('./src/lib/constants/brand');

const root = process.env.ROOT || '';
if (root.length > 0 && !root.endsWith('/')) {
    throw new Error('If ROOT is defined, it must have a trailing slash.');
}

const htmlWebpackPluginCommon = {
    root: root,
    meta: JSON.parse(process.env.EXTRA_META || '{}'),
    // Without this, html-webpack-plugin 4 emits plain blocking <script> tags, so the
    // ~9 MB of initial chunks download strictly one-after-another. defer lets the
    // browser fetch them all in parallel and only execute in order after parsing,
    // which is most of the first-paint delay on a cold cache.
    scriptLoading: 'defer',
    APP_NAME
};

// When this changes, the path for all JS files will change, bypassing any HTTP caches
const CACHE_EPOCH = 'gleba4';

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.SOURCEMAP || (process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map'),
    devServer: {
        contentBase: path.resolve(__dirname, 'build'),
        host: '0.0.0.0',
        disableHostCheck: true,
        compress: true,
        port: process.env.PORT || 8601,
        // allows ROUTING_STYLE=wildcard to work properly
        historyApiFallback: {
            rewrites: [
                {from: /^\/\d+\/?$/, to: '/index.html'},
                {from: /^\/\d+\/fullscreen\/?$/, to: '/fullscreen.html'},
                {from: /^\/\d+\/editor\/?$/, to: '/editor.html'},
                {from: /^\/\d+\/embed\/?$/, to: '/embed.html'},
                {from: /^\/addons\/?$/, to: '/addons.html'}
            ]
        }
    },
    output: {
        library: 'GUI',
        filename: process.env.NODE_ENV === 'production' ?
            `js/${CACHE_EPOCH}/[name].[contenthash].js` : 'js/[name].js',
        chunkFilename: process.env.NODE_ENV === 'production' ?
            `js/${CACHE_EPOCH}/[name].[contenthash].js` : 'js/[name].js',
        publicPath: root
    },
    resolve: {
        symlinks: false,
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        // scratch-* are file: symlinks into D:\PineEditor\_sdeps. With
        // symlinks:false webpack resolves them at their REAL path (_sdeps),
        // where their deps (@bilup/..., @turbowarp/...) are NOT installed in
        // the adjacent node_modules. Fall back to _sdeps/node_modules so those
        // deps resolve from the pnpm store that already holds them.
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '..', '_sdeps', 'node_modules')
        ],
        alias: {
            'react': require.resolve('react'),
            'react-dom': require.resolve('react-dom'),
            'text-encoding$': path.resolve(__dirname, 'src/lib/tw-text-encoder'),
            'scratch-render-fonts$': path.resolve(__dirname, 'src/lib/tw-scratch-render-fonts'),
            'exports-loader': require.resolve('exports-loader'),
            'components': path.resolve(__dirname, 'src/components/ai/gandi/components'),
            'utils': path.resolve(__dirname, 'src/utils'),
            'html2canvas': path.resolve(__dirname, 'src/lib/html2canvas-stub.js'),
            'just-bash$': path.resolve(__dirname, 'node_modules/just-bash/dist/bundle/browser.js'),
            'node:zlib$': path.resolve(__dirname, 'src/lib/just-bash-zlib.js'),
            // just-bash bundles an ESM-only minimatch@10 that webpack 4 cannot parse.
            // Pin it to the hoisted CJS minimatch@3 (already used by glob/babel/eslint),
            // whose API is a superset of what just-bash needs (minimatch()).
            'minimatch': require.resolve('minimatch'),
            '@remixwarp/scratch-l10n': path.resolve(__dirname, 'node_modules/@remixwarp/scratch-l10n'),
            // scratch-* deps that live only in the _sdeps store
            '@bilup/scratch-svg-renderer': path.resolve(__dirname, '..', '_sdeps', 'node_modules', '@bilup', 'scratch-svg-renderer'),
            '@bilup/scratch-render-fonts': path.resolve(__dirname, '..', '_sdeps', 'node_modules', '@bilup', 'scratch-render-fonts'),
            '@turbowarp/sb3fix': path.resolve(__dirname, '..', '_sdeps', 'node_modules', '@turbowarp', 'sb3fix'),
            '@turbowarp/json': path.resolve(__dirname, '..', '_sdeps', 'node_modules', '@turbowarp', 'json'),
            '@turbowarp/paper': path.resolve(__dirname, '..', '_sdeps', 'node_modules', '@turbowarp', 'paper'),
            // scratch-vm requires htmlparser2@3 (CJS, parseDOM); the hoisted top-level
            // copy is v10 (ESM) which webpack 4 cannot parse. Pin the scoped consumer
            // to scratch-vm's own installed v3 + its CJS friends.
            'htmlparser2': path.resolve(__dirname, '..', '_sdeps', 'scratch-vm', 'node_modules', 'htmlparser2'),
            'entities': path.resolve(__dirname, '..', '_sdeps', 'scratch-vm', 'node_modules', 'entities'),
            'domhandler': path.resolve(__dirname, '..', '_sdeps', 'scratch-vm', 'node_modules', 'domhandler'),
            'domutils': path.resolve(__dirname, '..', '_sdeps', 'scratch-vm', 'node_modules', 'domutils'),
            'domelementtype': path.resolve(__dirname, '..', '_sdeps', 'scratch-vm', 'node_modules', 'domelementtype')
        }
    },
    node: {
        __dirname: false,
        __filename: false
    },
    resolveLoader: {
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, '..', '_sdeps', 'node_modules')
        ]
    },
    module: {
        // peerjs bundles its own parcel module system; webpack's static analysis
        // trips over its dynamic require() and emits a "Critical dependency" warning.
        noParse: /node_modules[\\/]peerjs[\\/]dist[\\/]peerjs\.min\.js/,
        rules: [{
            // accounts-sdk ships esbuild/tsc output that uses TS class-field syntax
            // (e.g. `status;` / `data;` inside class bodies), which webpack 4's own
            // parser cannot handle. Force it through babel with class-properties support.
            test: /node_modules[\\/]accounts-sdk[\\/].*\.(js|mjs)$/,
            loader: 'babel-loader',
            options: {
                babelrc: false,
                plugins: [require.resolve('@babel/plugin-proposal-class-properties')],
                presets: [
                    ['@babel/preset-env', {
                        targets: {esmodules: true}
                    }]
                ]
            }
        }, {
            test: /\.(jsx?|tsx?|mjs)$/,
            loader: 'babel-loader',
            include: [
                path.resolve(__dirname, 'src'),
                /node_modules[\\/]scratch-[^\\/]+[\\/]src/,
                /node_modules[\\/]pify/,
                /node_modules[\\/]@vernier[\\/]godirect/,
                /node_modules[\\/]domelementtype/,
                /node_modules[\\/]domutils/,
                /node_modules[\\/]react-markdown/,
                /node_modules[\\/]isomorphic-git/,
                /node_modules[\\/]fractch/,
                /node_modules[\\/]just-bash/,
                /node_modules[\\/]monaco-editor/,
                /node_modules[\\/]rotur-sdk/,
                /node_modules[\\/]accounts-sdk/,
                /node_modules[\\/]fake-indexeddb/,
                /node_modules[\\/]@remixwarp[\\/]scratch-l10n/
            ],
            exclude: [
                /\.(vert|frag|glsl|ttf|woff2?|eot|png|jpe?g|gif|svg)$/,
                /node_modules[\\/]scratch-render[\\/]src[\\/]shaders/
            ],
            options: {
                cacheDirectory: true,
                // Explicitly disable babelrc so we don't catch various config
                // in much lower dependencies.
                babelrc: false,
                plugins: [
                    '@babel/plugin-transform-class-static-block',
                    ['react-intl', {
                        messagesDir: './translations/messages/'
                    }]
                ],
                presets: [
                    ['@babel/preset-env', {
                        bugfixes: true,
                        browserslistEnv: 'production'
                    }],
                    '@babel/preset-react',
                    '@babel/preset-typescript'
                ]
            }
        },
        {
            test: /\.css$/,
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: true,
                    importLoaders: 1,
                    localIdentName: '[name]_[local]_[hash:base64:5]',
                    camelCase: true
                }
            }, {
                loader: 'postcss-loader',
                options: {
                    ident: 'postcss',
                    plugins: function () {
                        return [
                            postcssImport,
                            postcssVars,
                            autoprefixer
                        ];
                    }
                }
            }]
        },
        {
            test: /\.less$/,
            use: [{
                loader: 'style-loader'
            }, {
                loader: 'css-loader',
                options: {
                    modules: true,
                    importLoaders: 2,
                    localIdentName: '[name]_[local]_[hash:base64:5]',
                    camelCase: true
                }
            }, {
                loader: 'postcss-loader',
                options: {
                    ident: 'postcss',
                    plugins: function () {
                        return [
                            postcssImport,
                            postcssVars,
                            autoprefixer
                        ];
                    }
                }
            }, {
                loader: 'less-loader'
            }]
        },
        {
            // src/generated/microbit-hex-url.cjs pulls in the micro:bit firmware image, which
            // the static/ copy step also ships verbatim at microbit/scratch-microbit-1.2.0.hex.
            // Naming the emitted file to match that exact path collapses the two identical
            // 1.13 MB blobs into one instead of shipping both.
            test: /\.hex$/,
            use: [{
                loader: 'url-loader',
                options: {
                    limit: 16 * 1024,
                    name: 'microbit/[name].[ext]',
                    esModule: false
                }
            }]
        },
        {
            test: /\.raw\.(js|jsx|json|md)$/,
            use: 'raw-loader'
        },
        {
            test: /\.(glsl|vert|frag)$/,
            use: 'raw-loader'
        },
        {
            test: /\.json$/,
            type: 'json'
        }, {
            // Fonts are fetched at runtime by src/lib/tw-scratch-render-fonts, which accepts
            // either a data: URL or a real file URL. Shipping them as files keeps ~410 KB of
            // woff2 out of the JS bundle (base64 inflates by ~33%), lets them download in
            // parallel with the app code, and gives each one its own long-lived hashed cache
            // entry. Anything under 1 KB (nothing, currently) still inlines as a data URL.
            test: /\.(ttf|eot|woff2?)$/,
            loader: 'url-loader',
            options: {
                limit: 1024,
                name: 'static/assets/[name].[hash:8].[ext]',
                esModule: false
            }
        }]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/scratch-blocks/media',
                    to: 'static/blocks-media/default'
                },
                {
                    from: 'node_modules/scratch-blocks/media',
                    to: 'static/blocks-media/high-contrast'
                },
                {
                    from: 'src/lib/themes/blocks/high-contrast-media/blocks-media',
                    to: 'static/blocks-media/high-contrast',
                    force: true
                },
                {
                    from: 'src/addons/addons-l10n',
                    to: 'addons-l10n'
                }
            ]
        })
    ],
    externals: {
        'electron': 'commonjs electron'
    }
}

if (!process.env.CI) {
    base.plugins.push(new webpack.ProgressPlugin());
}

// See webpack.import-expression.js: without this the bundled acorn's
// ImportExpression nodes are ignored by webpack 4 and every import() silently
// loses its async chunk.
base.plugins.push(new (require('./webpack.import-expression'))());

// The repo builds either in the local dev environment (with the _sdeps store,
// which holds the @bilup forks and scratch-vm's nested installed deps) or from
// pure npm-installed packages (GitHub Actions CI). The _sdeps-only bits below
// are only valid when that directory exists, so gate them on fs availability.
const _sdepsStore = path.resolve(__dirname, '..', '_sdeps', 'node_modules');
const hasSdepsStore = fs.existsSync(_sdepsStore);
if (!hasSdepsStore) {
    const alias = base.resolve.alias;
    // Directly imported by src but only shipped via the _sdeps @bilup forks;
    // in CI they resolve to the npm-installed equivalents already in deps.
    alias['@bilup/scratch-l10n'] = path.resolve(__dirname, 'node_modules/@remixwarp/scratch-l10n');
    alias['@bilup/scratch-svg-renderer'] = path.resolve(__dirname, 'node_modules/@turbowarp/scratch-svg-renderer');
    // scratch-vm's transitive deps resolve normally from its own nested
    // node_modules once the _sdeps redirects are removed.
    delete alias['@bilup/scratch-render-fonts'];
    delete alias['@turbowarp/sb3fix'];
    delete alias['@turbowarp/json'];
    delete alias['@turbowarp/paper'];
    delete alias['htmlparser2'];
    delete alias['entities'];
    delete alias['domhandler'];
    delete alias['domutils'];
    delete alias['domelementtype'];
    // The _sdeps fallback dirs don't exist in CI.
    base.resolve.modules = [path.resolve(__dirname, 'node_modules')];
    base.resolveLoader.modules = [path.resolve(__dirname, 'node_modules')];
}

module.exports = [
    // to run editor examples
    defaultsDeep({}, base, {
        entry: {
            'editor': './src/playground/editor.jsx',
            'player': './src/playground/player.jsx',
            'fullscreen': './src/playground/fullscreen.jsx',
            'embed': './src/playground/embed.jsx',
            'addon-settings': './src/playground/addon-settings.jsx',
            'credits': './src/playground/credits/credits.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build')
        },
        module: {
            rules: base.module.rules.concat([
                {
                    // Note: woff2?/ttf/eot fonts are already handled by base rule with
                    // larger inline limit (200KB) above, so do not re-include them here.
                    test: /\.(svg|png|wav|mp3|gif|jpg)$/,
                    loader: 'url-loader',
                    options: {
                        limit: 2048,
                        outputPath: 'static/assets/',
                        esModule: false
                    }
                }
            ])
        },
        optimization: {
            // Content-hashed module/chunk ids so an unrelated edit doesn't invalidate the
            // long-term cache of every other chunk.
            moduleIds: 'hashed',
            chunkIds: 'size',
            splitChunks: {
                chunks: 'all',
                minChunks: 2,
                minSize: 40000,
                maxInitialRequests: 20,
                maxAsyncRequests: 20,
                cacheGroups: {
                    // Editor-only heavyweights. Giving them their own groups keeps them out
                    // of the chunks that player/embed/fullscreen load, and out of the path
                    // that runs before the paint editor or git panel is actually opened.
                    paint: {
                        test: /(scratch-paint|@turbowarp[\\/]paper|opentype\.js)[\\/]/,
                        name: 'paint',
                        chunks: 'all',
                        priority: 30,
                        enforce: true
                    },
                    gitTools: {
                        test: /(isomorphic-git|just-bash|lightning-fs)[\\/]/,
                        name: 'git-tools',
                        chunks: 'all',
                        priority: 30,
                        enforce: true
                    },
                    monaco: {
                        test: /[\\/]monaco-editor[\\/]/,
                        name: 'monaco',
                        chunks: 'all',
                        priority: 30,
                        enforce: true
                    },
                    // VM engine plus project storage/compression. Every runtime entry needs
                    // these, so they stay in one shared, cacheable chunk.
                    scratchVm: {
                        test: /(scratch-vm|@bilup[\\/]scratch-storage|scratch-parser|scratch-sb1-converter|jszip|@turbowarp[\\/]jszip|pako|ajv)[\\/]/,
                        name: 'scratch-vm',
                        chunks: 'all',
                        priority: 25,
                        enforce: true
                    },
                    scratchRender: {
                        test: /(scratch-render|twgl\.js|scratch-svg-renderer|@bilup[\\/]scratch-svg-renderer)[\\/]/,
                        name: 'scratch-render',
                        chunks: 'all',
                        priority: 25,
                        enforce: true
                    },
                    react: {
                        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|react-intl|react-redux|redux|react-tabs|react-responsive|react-draggable|react-modal|immutable|classnames)[\\/]/,
                        name: 'react',
                        chunks: 'all',
                        priority: 25,
                        enforce: true
                    },
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: -10,
                        reuseExistingChunk: true
                    },
                    common: {
                        name: 'common',
                        minChunks: 2,
                        chunks: 'all',
                        priority: -20,
                        reuseExistingChunk: true
                    }
                }
            },
            runtimeChunk: 'single',
            minimize: process.env.NODE_ENV === 'production',
            minimizer: process.env.NODE_ENV === 'production' ? [
                new (require('terser-webpack-plugin').default || require('terser-webpack-plugin'))({
                    parallel: true,
                    terserOptions: {
                        ecma: 2018,
                        compress: {
                            passes: 2,
                            // NOTE: do not enable drop_console here. @turbowarp/nanolog builds
                            // its API as `log.error = console.error.bind(...)`, so drop_console
                            // rewrites those bindings to `undefined` and every `log.error(...)`
                            // call in the GUI, scratch-vm and scratch-render throws
                            // "log.error is not a function" at runtime.
                            drop_console: false,
                            drop_debugger: true,
                            dead_code: true,
                            unused: true,
                            if_return: true,
                            join_vars: true,
                            collapse_vars: true,
                            reduce_vars: true,
                            hoist_funs: true,
                            sequences: true,
                            conditionals: true,
                            comparisons: true,
                            evaluate: true,
                            booleans: true,
                            switches: true,
                            side_effects: true,
                            negate_iife: true,
                            toplevel: true
                        },
                        mangle: {
                            safari10: true
                        },
                        output: {
                            comments: false,
                            beautify: false
                        }
                    }
                })
            ] : []
        },
        plugins: base.plugins.concat([
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
                'process.env.DEBUG': Boolean(process.env.DEBUG),
                'process.env.ENABLE_SERVICE_WORKER': JSON.stringify(process.env.ENABLE_SERVICE_WORKER || ''),
                'process.env.ROOT': JSON.stringify(root),
                'process.env.ROUTING_STYLE': JSON.stringify(process.env.ROUTING_STYLE || 'filehash'),
                'process.env.MW_COMMUNITY': JSON.stringify(process.env.MW_COMMUNITY || ''),
                'react-dom.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.DO_NOT_USE_THIS_YET': true
            }),
            new HtmlWebpackPlugin({
                chunks: ['editor'],
                template: 'src/playground/index.ejs',
                filename: 'editor.html',
                title: `${APP_NAME}-Editor`,
                description: `Create, edit, and share projects with ${APP_NAME}'s powerful Scratch editor. Build games, animations, and interactive stories with advanced features and optimizations.`,
                isEditor: true,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['editor'],
                template: 'src/playground/index.ejs',
                filename: 'index.html',
                title: `${APP_NAME} - Editor`,
                description: `Create, edit, and share projects with ${APP_NAME}'s powerful Scratch editor. Build games, animations, and interactive stories with advanced features and optimizations.`,
                isEditor: true,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['fullscreen'],
                template: 'src/playground/index.ejs',
                filename: 'fullscreen.html',
                title: `${APP_NAME} - Refactoring freedom`,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['embed'],
                template: 'src/playground/embed.ejs',
                filename: 'embed.html',
                title: `Embedded Project - ${APP_NAME}`,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['addon-settings'],
                template: 'src/playground/simple.ejs',
                filename: 'addons.html',
                title: `Addon Settings - ${APP_NAME}`,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['credits'],
                template: 'src/playground/simple.ejs',
                filename: 'credits.html',
                title: `${APP_NAME} Credits`,
                ...htmlWebpackPluginCommon
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'static',
                        to: '',
                        // static/rw.html is a 20 MB QQ chat-log export that was left behind
                        // in the source tree. Nothing under src/ links to it any more (the
                        // old footer link was removed), so copying it only bloats the deploy
                        // by 20 MB. The source file itself is left untouched on disk.
                        globOptions: {
                            ignore: ['**/rw.html']
                        }
                    }
                ]
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'extensions/**',
                        to: 'static',
                        context: 'src/examples'
                    }
                ]
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'asset',
                        to: 'asset',
                        noErrorOnMissing: true
                    }
                ]
            })
        ])
    })
].concat(
    process.env.NODE_ENV === 'production' || process.env.BUILD_MODE === 'dist' ? (
        // export as library
        defaultsDeep({}, base, {
            target: 'web',
            entry: {
                'scratch-gui': './src/index.js'
            },
            output: {
                libraryTarget: 'umd',
                filename: 'js/[name].js',
                chunkFilename: 'js/[name].js',
                path: path.resolve('dist'),
                publicPath: `${STATIC_PATH}/`
            },
            externals: {
                'react': 'react',
                'react-dom': 'react-dom'
            },
            module: {
                rules: base.module.rules.concat([
                    {
                        // Note: woff2?/ttf/eot fonts are already handled by base rule with
                        // larger inline limit (200KB) above, so do not re-include them here.
                        test: /\.(svg|png|wav|mp3|gif|jpg)$/,
                        loader: 'url-loader',
                        options: {
                            limit: 2048,
                            outputPath: 'static/assets/',
                            publicPath: `${STATIC_PATH}/assets/`,
                            esModule: false
                        }
                    }
                ])
            },
            plugins: base.plugins.concat([
                new CopyWebpackPlugin({
                    patterns: [
                        {
                            from: 'extension-worker.{js,js.map}',
                            context: 'node_modules/scratch-vm/dist/web',
                            noErrorOnMissing: true
                        }
                    ]
                }),
                // Include library JSON files for scratch-desktop to use for downloading
                new CopyWebpackPlugin({
                    patterns: [
                        {
                            from: 'src/lib/libraries/*.json',
                            to: 'libraries',
                            flatten: true
                        }
                    ]
                }),
                // Copy local assets for library loading
                new CopyWebpackPlugin({
                    patterns: [
                        {
                            from: 'asset',
                            to: 'asset',
                            noErrorOnMissing: true
                        }
                    ]
                })
            ])
        })) : []
);
