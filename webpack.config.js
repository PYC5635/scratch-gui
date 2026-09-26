const defaultsDeep = require('lodash.defaultsdeep');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const webpack = require('webpack');

try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of envFile.split('\n')) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match && !(match[1] in process.env)) {
            process.env[match[1]] = match[2];
        }
    }
} catch (e) {
    // .env is optional
}

const ENABLE_COMMUNITY = true;

// Plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// PostCss
const autoprefixer = require('autoprefixer');
const postcssVars = require('postcss-simple-vars');
const postcssImport = require('postcss-import');

const {getHtmlWebpackPluginHooks} = require('html-webpack-plugin/lib/hooks');

// Inject the editor entry's JS chunk list into the community homepage HTML
// (window.MW_EDITOR_CHUNKS). The community site reads this and prefetches the
// editor's heavy bundles while the user is still browsing, so the first
// navigation into the editor no longer blocks on a huge download.
class EditorChunkPrefetchPlugin {
    apply (compiler) {
        compiler.hooks.compilation.tap('EditorChunkPrefetchPlugin', compilation => {
            // afterTemplateExecution runs before html-webpack-plugin injects its
            // own <script> tags, so our window.MW_EDITOR_CHUNKS definition is
            // guaranteed to run before the community bundle.
            getHtmlWebpackPluginHooks(compilation).afterTemplateExecution.tapAsync(
                'EditorChunkPrefetchPlugin',
                (data, callback) => {
                    const chunks = data.plugin.options.chunks;
                    // Only the community homepage gets the prefetch list.
                    if (!Array.isArray(chunks) || !chunks.includes('community')) {
                        return callback();
                    }
                    const entrypoint = compilation.entrypoints.get('editor');
                    if (!entrypoint) {
                        return callback();
                    }
                    const scripts = [];
                    for (const chunk of entrypoint.chunks) {
                        for (const file of chunk.files || []) {
                            if (/\.js$/.test(file)) {
                                scripts.push(`${root}${file}`);
                            }
                        }
                    }
                    if (scripts.length === 0) {
                        return callback();
                    }
                    const tag = `<script>window.MW_EDITOR_CHUNKS=${JSON.stringify(scripts)};</script>`;
                    data.html = data.html.replace('</body>', `${tag}</body>`);
                    callback();
                }
            );
        });
    }
}

const STATIC_PATH = process.env.STATIC_PATH || '/static';
const {APP_NAME} = require('./src/lib/constants/brand');

const root = process.env.ROOT || '/';
if (root.length > 0 && !root.endsWith('/')) {
    throw new Error('If ROOT is defined, it must have a trailing slash.');
}

const htmlWebpackPluginCommon = {
    root: root,
    meta: JSON.parse(process.env.EXTRA_META || '{}'),
    APP_NAME
};

// When this changes, the path for all JS files will change, bypassing any HTTP caches
const CACHE_EPOCH = 'gleba';

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.SOURCEMAP || (process.env.NODE_ENV === 'production' ? false : 'cheap-module-source-map'),
    devServer: {
        contentBase: false,
        host: '0.0.0.0',
        disableHostCheck: true,
        compress: true,
        headers: {'Access-Control-Allow-Origin': '*'},
        port: process.env.PORT || 8601,
        // allows ROUTING_STYLE=wildcard to work properly
        historyApiFallback: {
            rewrites: [
                {from: /^\/editor\/?$/, to: '/editor.html'},
                {from: /^\/fullscreen\/?$/, to: '/fullscreen.html'},
                {from: /^\/embed\/?$/, to: '/embed.html'},
                {from: /^\/addons\/?$/, to: '/addons.html'},
                {from: /^\/\d+\/?$/, to: '/player.html'},
                {from: /^\/\d+\/fullscreen\/?$/, to: '/fullscreen.html'},
                {from: /^\/\d+\/editor\/?$/, to: '/editor.html'},
                {from: /^\/\d+\/embed\/?$/, to: '/embed.html'}
                // anything else (/, /explore, /project/*, /users/*, /settings)
                // falls through to index.html (the community app)
            ]
        },
        // Local stand-in for functions/api/proxy.js: same-origin endpoint that
        // forwards to an arbitrary http(s) URL so project_url loads don't get
        // blocked by CORS. Only the request path /api/proxy is proxied.
        before (app) {
            app.get('/api/proxy', (req, res) => {
                const target = req.query.url;
                if (!target || !/^https?:\/\//i.test(target)) {
                    res.status(400).end('Bad request: missing or invalid url parameter');
                    return;
                }
                const lib = target.startsWith('https:') ? https : http;
                const proxyReq = lib.get(new URL(target), {
                    headers: {'User-Agent': 'Mozilla/5.0 (compatible; BilupDevProxy/1.0)'}
                }, upstream => {
                    res.status(upstream.statusCode || 200);
                    const contentType = upstream.headers['content-type'];
                    if (contentType) {
                        res.setHeader('content-type', contentType);
                    }
                    res.setHeader('cache-control', 'public, max-age=300');
                    upstream.pipe(res);
                });
                proxyReq.on('error', () => {
                    if (!res.headersSent) {
                        res.status(502).end('Proxy error');
                    } else {
                        res.end();
                    }
                });
            });
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
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        // Must be true so that pnpm symlinks are followed: with symlinks disabled,
        // htmlparser2@3.10.0 resolves "domhandler" to the hoisted 5.x (ESM object export)
        // instead of its own 2.x (CommonJS constructor), causing
        // "TypeError: DomHandler is not a constructor" in scratch-vm.
        symlinks: true,
        alias: {
            'react': require.resolve('react'),
            'react-dom': require.resolve('react-dom'),
            'text-encoding$': path.resolve(__dirname, 'src/lib/tw-text-encoder'),
            'just-bash$': path.resolve(__dirname, 'node_modules/just-bash/dist/bundle/browser.js'),
            'node:zlib$': path.resolve(__dirname, 'src/lib/just-bash-zlib.js'),
            // just-bash bundles an ESM-only minimatch@10 that webpack 4 cannot parse.
            // Pin it to the hoisted CJS minimatch@3 (already used by glob/babel/eslint),
            // whose API is a superset of what just-bash needs (minimatch()).
            'minimatch': require.resolve('minimatch'),
            'scratch-render-fonts$': path.resolve(__dirname, 'src/lib/tw-scratch-render-fonts'),
            'exports-loader': require.resolve('exports-loader'),
            'scratch-parser': path.resolve(__dirname, 'node_modules/scratch-parser')
        }
    },
    // Inline loaders (e.g. `imports-loader?x!exports-loader?y!...` in
    // scratch-blocks/shim/vertical.js) are resolved from the importing file's
    // real location after resolve.symlinks, which for linked repos is outside
    // this project's node_modules. Fall back to this project's node_modules so
    // imports-loader / exports-loader resolve even when scratch-blocks is linked.
    resolveLoader: {
        modules: [
            path.resolve(__dirname, 'node_modules'),
            'node_modules'
        ],
        alias: {
            'imports-loader': require.resolve('imports-loader'),
            'exports-loader': require.resolve('exports-loader')
        }
    },
    module: {
        // peerjs ships a self-contained browserify bundle whose internal
        // requires use its own parcelRequire polyfill (not webpack's require).
        // webpack 5 still scans it and emits a spurious
        // "Critical dependency: the request of a dependency is an expression"
        // warning at peerjs.min.js 1:292. Skipping parsing for peerjs removes
        // the warning and is safe because the bundle resolves its own modules.
        noParse: /peerjs/,
        rules: [{
            test: /\.tsx?$/,
            use: [
                {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        plugins: [
                            ['react-intl', {
                                messagesDir: './translations/messages/'
                            }]
                        ],
                        presets: ['@babel/preset-env', '@babel/preset-react']
                    }
                },
                {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true
                    }
                }
            ],
            include: [
                path.resolve(__dirname, 'src/addons')
            ],
            exclude: [
                /node_modules/
            ]
        }, {
            test: /\.m?jsx?$/,
            loader: 'babel-loader',
            include: [
                path.resolve(__dirname, 'src'),
                // Linked scratch-vm is resolved to its real sibling path by
                // resolve.symlinks, so the `node_modules/scratch-*/src` regex
                // below does not match it. Include it explicitly so its modern
                // syntax (?. / ??) gets transpiled by babel.
                path.resolve(__dirname, '..', 'scratch-vm', 'src'),
                path.resolve(__dirname, '..', 'scratch-paint', 'src'),
                /node_modules[\\/]scratch-[^\\/]+[\\/]src/,
                /node_modules[\\/]scratch-parser[\\/]/,
                /node_modules[\\/]pify/,
                /node_modules[\\/]@vernier[\\/]godirect/,
                /node_modules[\\/]@chenglou[\\/]pretext/,
                /node_modules[\\/]@xterm[\\/]/,
                /node_modules[\\/]fractch[\\/]src/,
                /node_modules[\\/]isomorphic-git/,
                /node_modules[\\/]just-bash/,
                /node_modules[\\/]monaco-editor/,
                /node_modules[\\/]rotur-sdk/,
                /node_modules[\\/]accounts-sdk/,
                /node_modules[\\/]fake-indexeddb/
            ],
            options: {
                babelrc: false,
                plugins: [
                    ['react-intl', {
                        messagesDir: './translations/messages/'
                    }]],
                presets: ['@babel/preset-env', '@babel/preset-react']
            }
        },
        {
            test: /node_modules[\\/](?:@fontsource|@xterm[\\/]xterm|monaco-editor)[\\/].*\.css$/,
            use: ['style-loader', 'css-loader']
        },
        {
            test: /\.css$/,
            exclude: /node_modules[\\/](?:@fontsource|@xterm[\\/]xterm|monaco-editor)[\\/]/,
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
            test: /\.hex$/,
            use: [{
                loader: 'url-loader',
                options: {
                    limit: 16 * 1024
                }
            }]
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
                    from: 'static/credits',
                    to: 'static/credits'
                }
            ]
        })
    ]
};

if (!process.env.CI) {
    base.plugins.push(new webpack.ProgressPlugin());
}

module.exports = [
    // to run editor examples
    defaultsDeep({}, base, {
        entry: {
            ...(ENABLE_COMMUNITY ? {community: './src/playground/community.jsx'} : {}),
            'editor': './src/playground/editor.jsx',
            'player': './src/playground/player.jsx',
            'fullscreen': './src/playground/fullscreen.jsx',
            'embed': './src/playground/embed.jsx',
            'addon-settings': './src/playground/addon-settings.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build')
        },
        module: {
            rules: base.module.rules.concat([
                {
                    test: /\.(svg|png|wav|mp3|gif|jpg|ttf|woff|woff2)$/,
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
            splitChunks: {
                chunks: 'all',
                minChunks: 2,
                minSize: 50000,
                maxInitialRequests: 12,
                cacheGroups: {
                    // The Scratch engine core is huge (~several MB). Splitting it out
                    // into its own chunk lets browsers download it in parallel with
                    // other scripts instead of being trapped inside one giant
                    // "vendors~editor~..." bundle, and lets the community site
                    // prefetch it in idle time before navigating to the editor.
                    // Note: `name` is intentionally fixed here - these engine libs
                    // are only used by the editor/player/embed/fullscreen entries,
                    // so a fixed name keeps a single shared, cacheable file.
                    scratchEngine: {
                        test: /node_modules[\\/](?:scratch-vm|scratch-render|scratch-svg-renderer|scratch-storage|scratch-audio|scratch-parser|@turbowarp[\\/]scratch-svg-renderer)[\\/]/,
                        name: 'scratch-engine',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    // Git support pulls in isomorphic-git, lightning-fs and JSZip.
                    // Most users never open the git panel, so keep these out of the
                    // shared vendors chunk and load them only when actually needed.
                    // (JSZip is still referenced synchronously by restore-points,
                    // so part of this chunk remains on the initial load path.)
                    gitLibs: {
                        test: /node_modules[\\/](?:isomorphic-git|@isomorphic-git|lightning-fs|@turbowarp[\\/]jszip|jszip)[\\/]/,
                        name: 'git-libs',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    // scratch-blocks is already lazy loaded via tw-lazy-scratch-blocks,
                    // but split it from the shared vendors chunk as well so the async
                    // "sb" chunk stays independent and reusable.
                    scratchBlocks: {
                        test: /node_modules[\\/]scratch-blocks[\\/]/,
                        name: 'scratch-blocks',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    // The paint editor is only mounted when the costume tab is opened.
                    scratchPaint: {
                        test: /node_modules[\\/]scratch-paint[\\/]/,
                        name: 'scratch-paint',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    // Monaco editor and xterm are heavy dependencies that are
                    // only used in specific panels (git modal, terminal, JSON
                    // editor). Split them out so they don't inflate the shared
                    // vendors chunk and are only downloaded when needed.
                    monacoEditor: {
                        test: /node_modules[\\/]monaco-editor[\\/]/,
                        name: 'monaco-editor',
                        priority: 20,
                        reuseExistingChunk: true
                    },
                    xterm: {
                        test: /node_modules[\\/](?:@xterm|xterm)[\\/]/,
                        name: 'xterm',
                        priority: 20,
                        reuseExistingChunk: true
                    }
                    // Other node_modules keep webpack's default behavior: the
                    // defaultVendors cacheGroup auto-names chunks per entry
                    // combination, so the community page never downloads code
                    // that only the editor needs.
                }
            }
        },
        plugins: base.plugins.concat([
            new EditorChunkPrefetchPlugin(),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
                'process.env.DEBUG': Boolean(process.env.DEBUG),
                'process.env.ENABLE_SERVICE_WORKER': JSON.stringify(process.env.ENABLE_SERVICE_WORKER || ''),
                'process.env.ROOT': JSON.stringify(root),
                'process.env.ROUTING_STYLE': JSON.stringify(process.env.ROUTING_STYLE || 'wildcard'),
                'process.env.MW_COMMUNITY': JSON.stringify(ENABLE_COMMUNITY ? 'true' : '')
            }),
            new HtmlWebpackPlugin({
                chunks: ['editor'],
                template: 'src/playground/index.ejs',
                filename: 'editor.html',
                title: `${APP_NAME} - Elevate your creation`,
                isEditor: true,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin(ENABLE_COMMUNITY ? {
                chunks: ['community'],
                template: 'src/playground/simple.ejs',
                filename: 'index.html',
                title: APP_NAME,
                ...htmlWebpackPluginCommon
            } : {
                chunks: ['editor'],
                template: 'src/playground/index.ejs',
                filename: 'index.html',
                title: `${APP_NAME} - Elevate your creation`,
                isEditor: true,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['player'],
                template: 'src/playground/index.ejs',
                filename: 'player.html',
                title: `${APP_NAME} - Elevate your creation`,
                ...htmlWebpackPluginCommon
            }),
            new HtmlWebpackPlugin({
                chunks: ['fullscreen'],
                template: 'src/playground/index.ejs',
                filename: 'fullscreen.html',
                title: `${APP_NAME} - Elevate your creation`,
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
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'static',
                        to: ''
                    }
                ]
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, '../docs/build'),
                        to: 'docs',
                        noErrorOnMissing: true
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
                        test: /\.(svg|png|wav|mp3|gif|jpg|ttf|woff|woff2)$/,
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
                })
            ])
        })) : []
);
