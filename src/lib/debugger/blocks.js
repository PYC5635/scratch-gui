import {getSetting} from './settings.js';

const parseArguments = code => code
    .split(/(?=[^\\]%[nbs])/g)
    .map(i => i.trim())
    .filter(i => i.charAt(0) === '%')
    .map(i => i.substring(0, 2));
const fixDisplayName = displayName =>
    displayName.replace(/([^\s])(%[nbs])/g, (_, before, arg) => `${before} ${arg}`);
const compareArrays = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const ZW = '\u200b\u200b';
const BREAKPOINT = `${ZW}breakpoint${ZW}`;
const LOG = `${ZW}log${ZW} %s`;
const WARN = `${ZW}warn${ZW} %s`;
const ERROR = `${ZW}error${ZW} %s`;

const addBlock = (vm, procedureCode, {args, displayName, callback}) => {
    const procCodeArguments = parseArguments(procedureCode);
    if (args.length !== procCodeArguments.length) {
        throw new Error('Procedure code and argument list do not match');
    }
    if (displayName) {
        displayName = fixDisplayName(displayName);
        const displayNameArguments = parseArguments(displayName);
        if (!compareArrays(procCodeArguments, displayNameArguments)) {
            displayName = procedureCode;
        }
    } else {
        displayName = procedureCode;
    }

    vm.addAddonBlock({
        procedureCode,
        arguments: args,
        callback: (a, util) => callback(a, util.thread),
        displayName
    });
};

const patchBlockly = () => {
    if (window.__mwDebuggerBlocklyPatched) return;
    const ScratchBlocks = window.ScratchBlocks;
    if (!ScratchBlocks) {
        setTimeout(patchBlockly, 500);
        return;
    }
    window.__mwDebuggerBlocklyPatched = true;

    const vm = window.vm;
    const BlockSvg = ScratchBlocks.BlockSvg;
    const oldUpdateColour = BlockSvg.prototype.updateColour;
    BlockSvg.prototype.updateColour = function (...args) {
        try {
            if (!this.isInsertionMarker() && this.type === 'procedures_call') {
                const block = this.procCode_ && vm && vm.runtime.getAddonBlock(this.procCode_);
                if (block) {
                    const theme = window.ReduxStore &&
                        window.ReduxStore.getState().scratchGui.theme.theme;
                    const colors = theme && theme.getBlockColors().addons;
                    if (colors) {
                        this.colour_ = colors.primary;
                        this.colourSecondary_ = colors.secondary;
                        this.colourTertiary_ = colors.tertiary;
                        this.colourQuaternary_ = colors.quaternary;
                    }
                    this.customContextMenu = null;
                }
            }
        } catch (e) {
            // updateColour 是每次积木重绘都会调用的高频钩子，
            // 一旦抛错会中断积木区渲染导致整个编辑器崩溃/卡死。
            // 兜底回退到原始实现，保证积木区始终可用。
        }
        return oldUpdateColour.call(this, ...args);
    };

    const originalCreateAllInputs = ScratchBlocks.Blocks.procedures_call.createAllInputs_;
    ScratchBlocks.Blocks.procedures_call.createAllInputs_ = function (...args) {
        try {
            const block = this.procCode_ && vm && vm.runtime.getAddonBlock(this.procCode_);
            if (block && block.displayName) {
                const originalProcCode = this.procCode_;
                this.procCode_ = block.displayName;
                const ret = originalCreateAllInputs.call(this, ...args);
                this.procCode_ = originalProcCode;
                return ret;
            }
        } catch (e) {
            // 自定义块逻辑失败时回退到原始实现，避免积木区崩溃
        }
        return originalCreateAllInputs.call(this, ...args);
    };

    if (vm && vm.editingTarget) {
        vm.emitWorkspaceUpdate();
    }
};

const registerDebuggerBlocks = (vm, handlers) => {
    if (vm.__mwDebuggerBlocksInstalled) return;
    vm.__mwDebuggerBlocksInstalled = true;

    const {onLog, onBreakpoint, onClearLogs, msg} = handlers;

    addBlock(vm, BREAKPOINT, {
        args: [],
        displayName: msg('debugger/block-breakpoint', 'breakpoint'),
        callback: (_, thread) => onBreakpoint(thread)
    });
    addBlock(vm, LOG, {
        args: [msg('debugger/argument-content', 'value')],
        displayName: msg('debugger/block-log', 'log %s'),
        callback: (args, thread) => onLog(Object.values(args)[0], thread, 'log')
    });
    addBlock(vm, WARN, {
        args: [msg('debugger/argument-content', 'value')],
        displayName: msg('debugger/block-warn', 'warn %s'),
        callback: (args, thread) => onLog(Object.values(args)[0], thread, 'warn')
    });
    addBlock(vm, ERROR, {
        args: [msg('debugger/argument-content', 'value')],
        displayName: msg('debugger/block-error', 'error %s'),
        callback: (args, thread) => onLog(Object.values(args)[0], thread, 'error')
    });

    patchBlockly();

    const ogGreenFlag = vm.runtime.greenFlag;
    vm.runtime.greenFlag = function (...args) {
        if (getSetting('log_clear_greenflag')) {
            onClearLogs();
        }
        if (getSetting('log_greenflag')) {
            onLog(msg('debugger/log-msg-flag-clicked', 'Green flag clicked'), null, 'internal');
        }
        return ogGreenFlag.call(this, ...args);
    };

    const ogStartHats = vm.runtime.startHats;
    vm.runtime.startHats = function (hat, optMatchFields, ...args) {
        if (getSetting('log_broadcasts') && hat === 'event_whenbroadcastreceived') {
            onLog(
                msg('debugger/log-msg-broadcasted', 'Broadcasted {broadcast}').replace('{broadcast}', optMatchFields.BROADCAST_OPTION),
                vm.runtime.sequencer.activeThread,
                'internal'
            );
        }
        return ogStartHats.call(this, hat, optMatchFields, ...args);
    };

    const installCloneHook = () => {
        if (vm.__mwDebuggerCloneHookInstalled) return;
        const firstTarget = vm.runtime.targets[0];
        if (!firstTarget) return;
        vm.__mwDebuggerCloneHookInstalled = true;

        const proto = firstTarget.constructor.prototype;
        const ogMakeClone = proto.makeClone;
        proto.makeClone = function (...args) {
            if (getSetting('log_failed_clone_creation') && !vm.runtime.clonesAvailable()) {
                onLog(
                    msg('debugger/log-msg-clone-cap', 'Failed to create clone of {sprite}, cannot create over 300 clones.').replace('{sprite}', this.getName()),
                    vm.runtime.sequencer.activeThread,
                    'internal-warn'
                );
            }
            const clone = ogMakeClone.call(this, ...args);
            if (getSetting('log_clone_create') && clone) {
                onLog(
                    msg('debugger/log-msg-clone-created', 'Created clone of {sprite}.').replace('{sprite}', this.getName()),
                    vm.runtime.sequencer.activeThread,
                    'internal'
                );
            }
            return clone;
        };
    };
    installCloneHook();
    vm.runtime.on('PROJECT_LOADED', installCloneHook);
};

// Re-apply the block display names for the injected debugger blocks using the
// current locale. The block text is captured from msg() at registration time,
// so it would otherwise stay in whatever language was active at that moment.
// This only updates the stored displayName on the already-registered addon
// blocks (no new palette entries are added) and triggers a workspace redraw.
const BLOCK_TEXT = [
    [BREAKPOINT, 'debugger/block-breakpoint', 'breakpoint'],
    [LOG, 'debugger/block-log', 'log %s'],
    [WARN, 'debugger/block-warn', 'warn %s'],
    [ERROR, 'debugger/block-error', 'error %s']
];

const relocalizeDebuggerBlocks = (vm, handlers) => {
    const addonBlocks = vm.runtime && vm.runtime.addonBlocks;
    if (!addonBlocks) return;
    const {msg} = handlers;
    for (const [code, key, fallback] of BLOCK_TEXT) {
        if (addonBlocks[code]) {
            addonBlocks[code].displayName = msg(key, fallback);
            // Keep the %s input's shadow label localized. The callback reads the
            // value positionally, so the name can safely change with the locale.
            const {arguments: argNames} = addonBlocks[code];
            if (Array.isArray(argNames) && argNames.length > 0) {
                const localizedArg = msg('debugger/argument-content', 'value');
                addonBlocks[code].arguments = argNames.map(() => localizedArg);
                const nids = addonBlocks[code].namesIdsDefaults;
                if (Array.isArray(nids) && nids[0]) {
                    nids[0] = addonBlocks[code].arguments.slice();
                }
            }
        }
    }
    if (vm.editingTarget && vm.emitWorkspaceUpdate) {
        vm.emitWorkspaceUpdate();
    }
};

export default registerDebuggerBlocks;
export {relocalizeDebuggerBlocks};
