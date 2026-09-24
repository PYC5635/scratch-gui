// From the NPM docs:
// "If you need to perform operations on your package before it is used, in a way that is not dependent on the
// operating system or architecture of the target system, use a prepublish script."
// Once this step is complete, a developer should be able to work without an Internet connection.
// See also: https://docs.npmjs.com/cli/using-npm/scripts

import fs from 'fs';
import path from 'path';
import nodeCrypto from 'crypto';

import crossFetch from 'cross-fetch';
import yauzl from 'yauzl';
import { fileURLToPath } from 'url';
//import cliProgress from 'cli-progress';

/** @typedef {import('yauzl').Entry} ZipEntry */
/** @typedef {import('yauzl').ZipFile} ZipFile */

// these aren't set in ESM mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// base/root path for the project
const basePath = path.join(__dirname, '..');

// Parse command line arguments for proxy
const args = process.argv.slice(2);
const proxyArgIndex = args.indexOf('--proxy');
const proxyUrl = proxyArgIndex !== -1 ? args[proxyArgIndex + 1] : null;

// Create fetch with proxy support
let fetchWithProxy = crossFetch;
if (proxyUrl) {
    console.info(`[Proxy] Using proxy: ${proxyUrl}`);
    
    if (proxyUrl.startsWith('http://')) {
        // HTTP proxy
        import('http-proxy-agent').then(({ HttpProxyAgent }) => {
            const agent = new HttpProxyAgent(proxyUrl);
            fetchWithProxy = (url, options = {}) => {
                return crossFetch(url, { ...options, agent });
            };
        }).catch(err => {
            console.warn(`[Proxy] Failed to load http-proxy-agent: ${err.message}`);
        });
    } else if (proxyUrl.startsWith('https://')) {
        // HTTPS proxy
        import('https-proxy-agent').then(({ HttpsProxyAgent }) => {
            const agent = new HttpsProxyAgent(proxyUrl);
            fetchWithProxy = (url, options = {}) => {
                return crossFetch(url, { ...options, agent });
            };
        }).catch(err => {
            console.warn(`[Proxy] Failed to load https-proxy-agent: ${err.message}`);
        });
    } else if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://')) {
        // SOCKS proxy
        const socksUrl = proxyUrl.replace('socks5://', 'socks://');
        import('socks-proxy-agent').then(({ SocksProxyAgent }) => {
            const agent = new SocksProxyAgent(socksUrl);
            fetchWithProxy = (url, options = {}) => {
                return crossFetch(url, { ...options, agent });
            };
        }).catch(err => {
            console.warn(`[Proxy] Failed to load socks-proxy-agent: ${err.message}`);
        });
    } else {
        console.warn(`[Proxy] Unsupported proxy protocol: ${proxyUrl}`);
    }
}

/**
 * Extract the first matching file from a zip buffer.
 * The path within the zip file is ignored: the destination path is `${destinationDirectory}/${basename(entry.name)}`.
 * Prints warnings if more than one matching file is found.
 * @param {function(ZipEntry): boolean} filter Returns true if the entry should be extracted.
 * @param {string} relativeDestDir The directory to extract to, relative to `basePath`.
 * @param {Buffer} zipBuffer A buffer containing the zip file.
 * @returns {Promise<string>} A Promise for the base name of the written file (without directory).
 */
const extractFirstMatchingFile = (filter, relativeDestDir, zipBuffer) => new Promise((resolve, reject) => {
    try {
        let extractedFileName;
        yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (zipError, zipfile) => {
            if (zipError) {
                throw zipError;
            }
            zipfile.readEntry();
            zipfile.on('end', () => {
                resolve(extractedFileName);
            });
            zipfile.on('entry', entry => {
                if (!filter(entry)) {
                    // ignore non-matching file
                    return zipfile.readEntry();
                }
                if (extractedFileName) {
                    console.warn(`Multiple matching files found. Ignoring: ${entry.fileName}`);
                    return zipfile.readEntry();
                }
                extractedFileName = entry.fileName;
                console.info(`Found matching file: ${entry.fileName}`);
                zipfile.openReadStream(entry, (fileError, readStream) => {
                    if (fileError) {
                        throw fileError;
                    }
                    const baseName = path.basename(entry.fileName);
                    const relativeDestFile = path.join(relativeDestDir, baseName);
                    console.info(`Extracting ${relativeDestFile}`);
                    const absoluteDestDir = path.join(basePath, relativeDestDir);
                    fs.mkdirSync(absoluteDestDir, { recursive: true });
                    const absoluteDestFile = path.join(basePath, relativeDestFile);
                    const outStream = fs.createWriteStream(absoluteDestFile);
                    readStream.on('end', () => {
                        outStream.close();
                        zipfile.readEntry();
                    });
                    readStream.pipe(outStream);
                });
            });
        });
    } catch (error) {
        reject(error);
    }
});

const downloadMicrobitHex = async () => {
    const url = 'https://packagerdata.turbowarp.org/scratch-microbit-1.2.0.hex.zip';
    const expectedSHA256 = 'dfd574b709307fe76c44dbb6b0ac8942e7908f4d5c18359fae25fbda3c9f4399';
    console.info(`Downloading ${url}`);
    const response = await fetchWithProxy(url);
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const sha256 = nodeCrypto.createHash('sha-256').update(zipBuffer).digest('hex');
    if (sha256 !== expectedSHA256) {
        throw new Error(`microbit hex has SHA-256 ${sha256} but expected ${expectedSHA256}`);
    }
    const relativeHexDir = path.join('static', 'microbit');
    const hexFileName = await extractFirstMatchingFile(
        entry => /\.hex$/.test(entry.fileName),
        path.join('static', 'microbit'),
        zipBuffer
    );
    const relativeHexFile = path.join(relativeHexDir, hexFileName);
    const relativeGeneratedDir = path.join('src', 'generated');
    const relativeGeneratedFile = path.join(relativeGeneratedDir, 'microbit-hex-url.cjs');
    const absoluteGeneratedDir = path.join(basePath, relativeGeneratedDir);
    fs.mkdirSync(absoluteGeneratedDir, { recursive: true });
    const absoluteGeneratedFile = path.join(basePath, relativeGeneratedFile);
    const requirePath = `./${path
        .relative(relativeGeneratedDir, relativeHexFile)
        .split(path.win32.sep)
        .join(path.posix.sep)}`;
    fs.writeFileSync(
        absoluteGeneratedFile,
        [
            '// This file is generated by scripts/prepublish.mjs',
            '// Do not edit this file directly',
            '// This file relies on a loader to turn this `require` into a URL',
            `module.exports = require('${requirePath}');`,
            '' // final newline
        ].join('\n')
    );
    console.info(`Wrote ${relativeGeneratedFile}`);
};

// const downloadLibraryAssets = async () => {
//     const libraryFiles = [
//         path.join('src', 'lib', 'libraries', 'costumes.json'),
//         path.join('src', 'lib', 'libraries', 'backdrops.json'),
//         path.join('src', 'lib', 'libraries', 'sprites.json'),
//         path.join('src', 'lib', 'libraries', 'sounds.json')
//     ];

//     const assetsDir = path.join('static', 'libassets');
//     const absoluteAssetsDir = path.join(basePath, assetsDir);
//     fs.mkdirSync(absoluteAssetsDir, { recursive: true });

//     const md5extList = new Set();

//     for (const libraryFile of libraryFiles) {
//         const absoluteLibraryFile = path.join(basePath, libraryFile);
//         if (!fs.existsSync(absoluteLibraryFile)) {
//             console.warn(`Library file not found: ${libraryFile}`);
//             continue;
//         }
//         const content = fs.readFileSync(absoluteLibraryFile, 'utf8');
//         const items = JSON.parse(content);
        
//         for (const item of items) {
//             if (item.costumes && Array.isArray(item.costumes)) {
//                 for (const costume of item.costumes) {
//                     if (costume.md5ext) {
//                         md5extList.add(costume.md5ext);
//                     }
//                 }
//             }
//             if (item.sounds && Array.isArray(item.sounds)) {
//                 for (const sound of item.sounds) {
//                     if (sound.md5ext) {
//                         md5extList.add(sound.md5ext);
//                     }
//                 }
//             }
//             if (item.md5ext) {
//                 md5extList.add(item.md5ext);
//             }
//         }
//     }

//     console.info(`[Library Assets] Found ${md5extList.size} unique assets to download`);

//     const totalAssets = md5extList.size;
//     let downloaded = 0;
//     let skipped = 0;
//     let failed = 0;
//     const failedItems = [];

//     const progressBar = new cliProgress.SingleBar({
//         format: '[Library Assets] [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
//         barCompleteChar: '\u2588',
//         barIncompleteChar: '\u2591',
//         hideCursor: true
//     });

//     progressBar.start(totalAssets, 0);

//     for (const md5ext of md5extList) {
//         const assetPath = path.join(assetsDir, md5ext);
//         const absoluteAssetPath = path.join(basePath, assetPath);
        
//         if (fs.existsSync(absoluteAssetPath)) {
//             skipped++;
//             progressBar.update(downloaded + skipped);
//             continue;
//         }

//         const url = `https://assets.scratch.mit.edu/internalapi/asset/${md5ext}/get/`;
        
//         try {
//             const response = await fetchWithProxy(url);
//             if (!response.ok) {
//                 failed++;
//                 failedItems.push({ md5ext, error: `HTTP ${response.status}` });
//                 progressBar.update(downloaded + skipped + failed);
//                 continue;
//             }
            
//             const buffer = Buffer.from(await response.arrayBuffer());
//             fs.writeFileSync(absoluteAssetPath, buffer);
//             downloaded++;
//             progressBar.update(downloaded + skipped + failed);
//         } catch (error) {
//             failed++;
//             failedItems.push({ md5ext, error: error.message });
//             progressBar.update(downloaded + skipped + failed);
//         }
//     }

//     progressBar.stop();
//     console.info(`[Library Assets] Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
    
//     if (failed > 0) {
//         console.warn('\n[Library Assets] Failed downloads:');
//         for (const item of failedItems) {
//             console.warn(`  - ${item.md5ext}: ${item.error}`);
//         }
//     }
// };

const prepublish = async () => {
    await downloadMicrobitHex();
    // await downloadLibraryAssets();
};

prepublish().then(
    () => {
        console.info('Prepublish script complete');
        process.exit(0);
    },
    e => {
        console.error(e);
        process.exit(1);
    }
);