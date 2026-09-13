import VMApplier from '../../../src/lib/collaboration/vm-applier.js';
import {OP} from '../../../src/lib/collaboration/protocol.js';

const makeVm = () => {
    const registered = new Map();
    const loadCalls = [];
    const manager = {
        _loadedExtensions: registered,
        isExtensionLoaded: id => registered.has(id),
        getExtensionURLs: () => {
            const urls = {};
            registered.forEach((service, id) => {
                // Builtins are not URL-keyed; custom extensions are.
                if (!['music', 'pen'].includes(id)) {
                    urls[id] = `https://example.com/${id}.js`;
                }
            });
            return urls;
        },
        loadExtensionURL: async url => {
            loadCalls.push(url);
            // Custom extensions register under their own declared id.
            if (url.startsWith('https://example.com/')) {
                const id = url.split('/').pop().replace('.js', '');
                registered.set(id, `unsandboxed.0.${id}`);
            }
        }
    };
    const vm = {
        runtime: {
            targets: [],
            getTargetById: () => null,
            requestTargetsUpdate: () => {}
        },
        extensionManager: manager,
        editingTarget: null,
        addSprite: async () => {},
        deleteSprite: () => {},
        renameSprite: () => {},
        reorderTarget: () => {},
        addCostume: async () => {},
        deleteCostume: () => {},
        renameCostume: () => {},
        reorderCostume: () => {},
        duplicateCostume: () => {},
        addSound: async () => {},
        deleteSound: () => {},
        renameSound: () => {},
        reorderSound: () => {},
        duplicateSound: () => {},
        updateSvg: () => {},
        updateBitmap: () => {},
        updateSoundBuffer: () => {},
        shareBlocksToTarget: async () => {},
        emitTargetsUpdate: () => {},
        setEditingTarget: () => {}
    };
    return {vm, registered, loadCalls};
};

describe('extension op application', () => {
    test('an extension already loaded under its declared id is not re-loaded by URL ops', async () => {
        const {vm, registered, loadCalls} = makeVm();
        const applier = new VMApplier({vm, getWorkspace: () => null});

        // Snapshot onboarding already loaded the custom extension.
        registered.set('myExt', 'unsandboxed.0.myExt');

        await applier.apply(OP.EXTENSION_LOAD, {
            extensionId: 'https://example.com/myExt.js'
        });
        // Repeated / replayed ops must also be no-ops.
        await applier.apply(OP.EXTENSION_LOAD, {
            extensionId: 'https://example.com/myExt.js'
        });

        expect(loadCalls).toEqual([]);
        applier.destroy();
    });

    test('an unloaded custom extension loads from its URL exactly once', async () => {
        const {vm, loadCalls} = makeVm();
        const applier = new VMApplier({vm, getWorkspace: () => null});

        await applier.apply(OP.EXTENSION_LOAD, {
            extensionId: 'https://example.com/myExt.js'
        });
        await applier.apply(OP.EXTENSION_LOAD, {
            extensionId: 'https://example.com/myExt.js'
        });

        expect(loadCalls).toEqual(['https://example.com/myExt.js']);
        applier.destroy();
    });

    test('builtin extensions are keyed by id and deduped as before', async () => {
        const {vm, registered, loadCalls} = makeVm();
        const applier = new VMApplier({vm, getWorkspace: () => null});

        registered.set('music', 'extension_0_music');
        await applier.apply(OP.EXTENSION_LOAD, {extensionId: 'music'});

        expect(loadCalls).toEqual([]);
        applier.destroy();
    });
});
