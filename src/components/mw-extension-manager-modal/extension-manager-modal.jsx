import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {GripVertical, RefreshCw, Trash2} from 'lucide-react';

import Modal from '../../containers/windowed-modal.jsx';
import FancyCheckbox from '../tw-fancy-checkbox/checkbox.jsx';

import extensionLibrary from '../../lib/libraries/extensions/index.jsx';
import centralDispatch from 'scratch-vm/src/dispatch/central-dispatch';
import {getExtensionSandboxStatus} from '../../containers/tw-security-manager.jsx';

import styles from './extension-manager-modal.css';

/* eslint-disable react/jsx-no-bind */

// 部分第三方扩展的 getInfo() 返回的 name 是多语言对象而非字符串
// （例如 {default: 'Foo', 'zh-cn': '...'}），这里统一提取字符串名称。
// 提取失败返回 null，调用方回退到扩展 id。
const extractExtensionName = rawName => {
    if (typeof rawName === 'string' && rawName) {
        return rawName;
    }
    if (rawName && typeof rawName === 'object') {
        const preferred = rawName.default || rawName.en || rawName['zh-cn'] || rawName.zh;
        if (typeof preferred === 'string' && preferred) {
            return preferred;
        }
        for (const value of Object.values(rawName)) {
            if (typeof value === 'string' && value) {
                return value;
            }
        }
    }
    return null;
};

const messages = defineMessages({
    title: {
        defaultMessage: 'Extension Manager',
        description: 'Title of modal that appears when opening the Extension Manager',
        id: 'tw.extensionManager.title'
    },
    refresh: {
        defaultMessage: 'Refresh',
        description: 'Recalculate the block counts shown for each extension',
        id: 'tw.extensionManager.refresh'
    },
    noneLoadedDescription: {
        defaultMessage: 'Extensions you add will appear here.',
        description: 'Hint shown when no extensions are loaded',
        id: 'tw.extensionManager.noneLoadedDescription'
    },
    deleteSelected: {
        defaultMessage: 'Delete selected ({count})',
        description: 'Button to delete selected extensions',
        id: 'tw.extensionManager.deleteSelected'
    },
    deleteExtension: {
        defaultMessage: 'Delete extension',
        description: 'Tooltip/aria label for removing a single extension',
        id: 'tw.extensionManager.deleteExtension'
    },
    dragHint: {
        defaultMessage: 'Drag rows to reorder extensions',
        description: 'Hint shown in the footer',
        id: 'tw.extensionManager.dragHint'
    },
    confirmDeleteTitle: {
        defaultMessage: 'Confirm delete',
        description: 'Title of the confirmation dialog shown when deleting an extension that is in use',
        id: 'tw.extensionManager.confirmDeleteTitle'
    },
    confirmDeleteSingle: {
        defaultMessage: 'Extension "{name}" is using {count} blocks. Deleting this extension will also delete these blocks. Are you sure you want to delete it?',
        description: 'Confirmation message shown when deleting a single extension that is in use',
        id: 'tw.extensionManager.confirmDeleteSingle'
    },
    confirmDeleteMultiple: {
        defaultMessage: '{count} selected extensions include {usingCount} that use {blockCount} blocks in total. Deleting them will also delete these blocks. Are you sure you want to delete them?',
        description: 'Confirmation message shown when deleting multiple selected extensions that are in use',
        id: 'tw.extensionManager.confirmDeleteMultiple'
    },
    confirmDeleteYes: {
        defaultMessage: 'Yes, delete',
        description: 'Button to confirm deleting the extension',
        id: 'tw.extensionManager.confirmDeleteYes'
    },
    confirmDeleteNo: {
        defaultMessage: 'No, keep',
        description: 'Button to cancel deleting the extension',
        id: 'tw.extensionManager.confirmDeleteNo'
    }
});

const ExtensionManagerModal = props => {
    const [selected, setSelected] = useState([]);
    const [dragIndex, setDragIndex] = useState(null);
    const [refreshCounter, setRefreshCounter] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const [blockIconURIs, setBlockIconURIs] = useState({});
    const [extensionColors, setExtensionColors] = useState({});
    const [extensionNames, setExtensionNames] = useState({});

    const extensionLibraryById = useMemo(() => new Map(extensionLibrary.map(i => [i.extensionId, i])), []);

    const readExtensionIds = useCallback(() => {
        const map = props.vm?.extensionManager?._loadedExtensions;
        if (!map) return [];
        return Array.from(map.keys());
    }, [props.vm]);

    const initialExtensions = useMemo(() => {
        if (!props.vm || !props.vm.extensionManager) return [];
        return Array.from(props.vm.extensionManager._loadedExtensions.keys());
    }, [props.vm]);

    const [extensionIds, setExtensionIds] = useState(initialExtensions);

    // Count how many blocks in the project use each loaded extension.
    // Extension block opcodes are prefixed with `${extensionId}_`, so the
    // part before the first underscore identifies the owning extension.
    // 可传入 id 列表进行实时计算（默认使用当前 state 中的 extensionIds）
    const calculateBlockCounts = useCallback((ids = extensionIds) => {
        const counts = new Map(ids.map(id => [id, 0]));
        const targets = (props.vm && props.vm.runtime && props.vm.runtime.targets) || [];
        for (const target of targets) {
            if (!target || target.isOriginal === false) continue;
            const blocks = target.blocks && target.blocks._blocks;
            if (!blocks) continue;
            for (const block of Object.values(blocks)) {
                if (!block || block.shadow || !block.opcode) continue;
                const separator = block.opcode.indexOf('_');
                if (separator === -1) continue;
                const prefix = block.opcode.substring(0, separator);
                if (counts.has(prefix)) {
                    counts.set(prefix, counts.get(prefix) + 1);
                }
            }
        }
        return counts;
    }, [props.vm, extensionIds]);

    const [blockCounts, setBlockCounts] = useState(() => calculateBlockCounts());

    // Recompute whenever the extension list or VM changes
    useEffect(() => {
        setBlockCounts(calculateBlockCounts());
    }, [calculateBlockCounts]);

    const getExtensionIconURL = useCallback(extensionId => {
        const libraryItem = extensionLibraryById.get(extensionId);
        if (libraryItem) return libraryItem.insetIconURL || libraryItem.iconURL;
        return blockIconURIs[extensionId] || null;
    }, [extensionLibraryById, blockIconURIs]);

    const getExtensionName = useCallback(extensionId => {
        const libraryItem = extensionLibraryById.get(extensionId);
        const rawName = libraryItem ? libraryItem.name : extensionNames[extensionId];
        // name 可能来自扩展库数据或第三方扩展 getInfo()，统一提取字符串，
        // 无法提取时回退到扩展 id（避免把 Object 渲染成 "[object Object]"）
        return extractExtensionName(rawName) || extensionId;
    }, [extensionLibraryById, extensionNames]);

    const getExtensionColor = useCallback(extensionId => {
        return extensionColors[extensionId] || null;
    }, [extensionColors]);

    /**
     * Determine the sandbox status for a loaded extension.
     * Checks the service name to determine if the extension is sandboxed or unsandboxed,
     * and whether it's from a trusted built-in source.
     * @param {string} extensionId The extension ID.
     * @returns {{label: string, type: string, color: string}|null} Sandbox status info or null if unknown.
     */
    const getExtensionSandboxInfo = useCallback(extensionId => {
        const map = props.vm?.extensionManager?._loadedExtensions;
        if (!map) return null;
        const serviceName = map.get(extensionId);
        if (!serviceName) return null;

        // Built-in extensions (music, pen, tw, etc.) are loaded internally
        // without going through getSandboxMode, so they have no cache entry.
        // They always run unsandboxed as trusted extensions.
        const isBuiltin = extensionLibraryById.has(extensionId);
        if (isBuiltin) {
            return {label: '信任的', type: 'trusted', color: '#27AE60'};
        }

        // For non-built-in extensions, try the cached sandbox status first
        // (populated by getSandboxMode during loading)
        const cachedStatus = getExtensionSandboxStatus(extensionId);
        if (cachedStatus) {
            return {
                ...cachedStatus,
                color: cachedStatus.type === 'trusted' ? '#27AE60' :
                       cachedStatus.type === 'unsandboxed' ? '#E74C3C' : '#4A90D9'
            };
        }

        // Fallback: determine from the service name
        const isUnsandboxed = typeof serviceName === 'string' && serviceName.startsWith('unsandboxed.');
        if (!isUnsandboxed) {
            return {label: '沙盒', type: 'sandboxed', color: '#4A90D9'};
        }
        return {label: '非沙盒', type: 'unsandboxed', color: '#E74C3C'};
    }, [props.vm, extensionLibraryById]);

    useEffect(() => {
        const map = props.vm?.extensionManager?._loadedExtensions;
        if (!map) return;

        // Extensions already in the library have a built-in icon, so only
        // fetch icon + color + name info for unknown (usually third-party) ones.
        // All of these are loaded together from a single getInfo() call.
        const idsToFetch = extensionIds.filter(id => (
            !extensionLibraryById.has(id) &&
            !blockIconURIs[id] &&
            !extensionColors[id] &&
            !extensionNames[id] &&
            map.has(id)
        ));
        if (idsToFetch.length === 0) return;

        let cancelled = false;
        idsToFetch.forEach(id => {
            const serviceName = map.get(id);
            centralDispatch.call(serviceName, 'getInfo')
                .then(info => {
                    if (cancelled) return;
                    const name = extractExtensionName(info && info.name);
                    const uri = info && info.blockIconURI;
                    const color = info && info.color1;
                    if (name) {
                        setExtensionNames(prev => (prev[id] ? prev : {...prev, [id]: name}));
                    }
                    if (!uri && !color) return;
                    // Only store the icon when we actually got a URI, so a
                    // failed icon fetch can be retried on the next refresh
                    // instead of being permanently cached as undefined.
                    setBlockIconURIs(prev => (
                        prev[id] || !uri ? prev : {...prev, [id]: uri}
                    ));
                    if (color) {
                        setExtensionColors(prev => ({...prev, [id]: color}));
                    }
                })
                .catch(() => {
                    // ignore
                });
        });

        return () => {
            cancelled = true;
        };
    }, [props.vm, extensionIds, refreshCounter, blockIconURIs, extensionColors, extensionNames, extensionLibraryById]);

    const updateExtensionIds = useCallback(() => {
        setExtensionIds(readExtensionIds());
    }, [readExtensionIds]);

    useEffect(() => {
        updateExtensionIds();

        const vm = props.vm;
        if (!vm) return;

        const onAdded = () => {
            updateExtensionIds();
        };
        const onRemoved = () => {
            updateExtensionIds();
            setSelected([]);
        };
        const onReordered = info => {
            if (info && Array.isArray(info.ids)) {
                setExtensionIds(info.ids);
                return;
            }
            updateExtensionIds();
        };

        vm.on('EXTENSION_ADDED', onAdded);
        vm.on('EXTENSION_REMOVED', onRemoved);
        vm.on('EXTENSIONS_REORDERED', onReordered);
        if (vm.runtime) {
            vm.runtime.on('PROJECT_LOADED', updateExtensionIds);
        }

        return () => {
            vm.off('EXTENSION_ADDED', onAdded);
            vm.off('EXTENSION_REMOVED', onRemoved);
            vm.off('EXTENSIONS_REORDERED', onReordered);
            if (vm.runtime) {
                vm.runtime.off('PROJECT_LOADED', updateExtensionIds);
            }
        };
    }, [props.vm, updateExtensionIds]);

    useEffect(() => {
        const loaded = new Set(extensionIds);
        setSelected(prev => prev.filter(id => loaded.has(id)));
    }, [extensionIds]);

    const handleRefresh = useCallback(() => {
        // Re-read the loaded extension list and force a fresh block count
        // calculation, since the project's blocks can change without any
        // of the memoized dependencies (vm, extensionIds) changing.
        setRefreshCounter(c => c + 1);
        updateExtensionIds();
        setBlockCounts(calculateBlockCounts());
    }, [updateExtensionIds, calculateBlockCounts]);

    const totalBlocks = useMemo(() => {
        let total = 0;
        for (const count of blockCounts.values()) total += count;
        return total;
    }, [blockCounts]);

    const updateSelection = e => {
        const {value, checked} = e.target;
        setSelected(old => {
            if (checked) return [...old, value];
            return old.filter(i => i !== value);
        });
    };

    const stopDragAndClickBubbling = e => {
        e.stopPropagation();
    };

    // 删除项目中使用了指定扩展的所有积木
    // 扩展积木的 opcode 以 `${extensionId}_` 开头，据此收集并删除。
    // 删除时同时处理监视器积木与监视器状态，避免留下失效积木或悬空引用。
    const deleteBlocksForExtension = extensionId => {
        const runtime = props.vm && props.vm.runtime;
        if (!runtime) return;
        const prefix = `${extensionId}_`;

        const collectBlockIds = blockContainer => {
            const ids = [];
            if (!blockContainer || !blockContainer._blocks) return ids;
            for (const id of Object.keys(blockContainer._blocks)) {
                const block = blockContainer._blocks[id];
                if (block && block.opcode && block.opcode.indexOf(prefix) === 0) {
                    ids.push(id);
                }
            }
            return ids;
        };

        const removeBlocksFrom = blockContainer => {
            const idsToDelete = collectBlockIds(blockContainer);
            if (idsToDelete.length === 0) return;
            const toDeleteSet = new Set(idsToDelete);

            // 先断开父积木对扩展积木的引用，避免删除后留下悬空引用
            for (const id of Object.keys(blockContainer._blocks)) {
                const block = blockContainer._blocks[id];
                if (!block) continue;
                if (block.next !== null && toDeleteSet.has(block.next)) {
                    block.next = null;
                }
                for (const inputName of Object.keys(block.inputs || {})) {
                    const input = block.inputs[inputName];
                    if (input && input.block !== null && toDeleteSet.has(input.block)) {
                        input.block = null;
                    }
                    if (input && input.shadow !== null && toDeleteSet.has(input.shadow)) {
                        input.shadow = null;
                    }
                }
            }

            // 删除扩展积木及其子堆叠（deleteBlock 会递归删除 next 链与输入积木）
            for (const id of idsToDelete) {
                blockContainer.deleteBlock(id);
            }
        };

        // 删除所有角色/舞台中的扩展积木
        const targets = runtime.targets || [];
        for (const target of targets) {
            if (target && target.blocks) {
                removeBlocksFrom(target.blocks);
            }
        }

        // 删除监视器积木并同步监视器状态
        const monitorIdsToDelete = collectBlockIds(runtime.monitorBlocks);
        removeBlocksFrom(runtime.monitorBlocks);
        for (const id of monitorIdsToDelete) {
            if (typeof runtime.requestRemoveMonitor === 'function') {
                runtime.requestRemoveMonitor(id);
            }
        }
    };

    // 实际执行删除（不经过确认拦截）：先清理扩展积木，再卸载扩展
    const performDelete = extensionIds => {
        if (!props.vm || !props.vm.extensionManager) return;
        // 1. 删除项目中使用这些扩展的积木
        for (const extensionId of extensionIds) {
            deleteBlocksForExtension(extensionId);
        }
        // 2. 刷新积木区，让 Blockly 移除已删除的积木
        if (typeof props.vm.refreshWorkspace === 'function') {
            props.vm.refreshWorkspace();
        }
        // 3. 卸载扩展
        for (const extensionId of extensionIds) {
            if (typeof props.vm.extensionManager.removeExtension === 'function') {
                props.vm.extensionManager.removeExtension(extensionId);
            }
        }
        setExtensionIds(old => old.filter(i => !extensionIds.includes(i)));
        setSelected(old => old.filter(i => !extensionIds.includes(i)));
        updateExtensionIds();
    };

    // 删除单个扩展：若扩展已被使用积木，则弹出确认对话框。
    // 删除前会先实时刷新扩展列表与积木使用数，确保提示的是最新数据
    const requestDeleteExtension = extensionId => {
        if (!props.vm || !props.vm.extensionManager) return;
        const freshIds = readExtensionIds();
        const freshCounts = calculateBlockCounts(freshIds);
        setExtensionIds(freshIds);
        setBlockCounts(freshCounts);
        const count = freshCounts.get(extensionId) || 0;
        if (count > 0) {
            setDeleteConfirm({
                ids: [extensionId],
                usingCount: 1,
                blockCount: count
            });
            return;
        }
        performDelete([extensionId]);
    };

    // 批量删除选中的扩展：任一扩展已使用积木则弹出确认对话框。
    // 删除前同样先实时刷新扩展列表与积木使用数
    const requestDeleteSelected = () => {
        if (selected.length === 0) return;
        const freshIds = readExtensionIds();
        const freshCounts = calculateBlockCounts(freshIds);
        setExtensionIds(freshIds);
        setBlockCounts(freshCounts);
        // 过滤掉已不在加载列表中的选中项
        const idsToDelete = selected.filter(id => freshIds.includes(id));
        if (idsToDelete.length === 0) return;
        let blockCount = 0;
        let usingCount = 0;
        for (const extensionId of idsToDelete) {
            const count = freshCounts.get(extensionId) || 0;
            if (count > 0) {
                blockCount += count;
                usingCount += 1;
            }
        }
        if (usingCount > 0) {
            setDeleteConfirm({
                ids: idsToDelete,
                usingCount,
                blockCount
            });
            return;
        }
        performDelete(idsToDelete);
    };

    const handleConfirmDelete = () => {
        if (!deleteConfirm) return;
        performDelete(deleteConfirm.ids);
        setDeleteConfirm(null);
    };

    const handleCancelDelete = () => {
        setDeleteConfirm(null);
    };

    const handleDragStart = e => {
        const index = Number(e.currentTarget.dataset.index);
        setDragIndex(index);

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            try {
                e.dataTransfer.setData('text/plain', String(index));
            } catch (err) {
                // ignore
            }
        }
    };

    const handleDrop = e => {
        const index = Number(e.currentTarget.dataset.index);
        let fromIndex = dragIndex;
        if (e.dataTransfer) {
            const raw = e.dataTransfer.getData('text/plain');
            const parsed = Number(raw);
            if (!Number.isNaN(parsed)) {
                fromIndex = parsed;
            }
        }

        if (fromIndex === null || fromIndex === index) return;

        setExtensionIds(old => {
            const next = [...old];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(index, 0, moved);
            return next;
        });
        setDragIndex(null);

        if (props.vm && props.vm.extensionManager && typeof props.vm.extensionManager.reorderExtension === 'function') {
            props.vm.extensionManager.reorderExtension(fromIndex, index);
            updateExtensionIds();
        }
    };

    const handleDragOver = e => {
        e.preventDefault();
    };

    const handleDragEnd = () => {
        setDragIndex(null);
    };

    return (
        <>
        <Modal
            centered
            className={styles.modalContent}
            contentLabel={props.intl.formatMessage(messages.title)}
            height={560}
            id="extensionManagerModal"
            minHeight={420}
            minWidth={500}
            onRequestClose={props.onClose}
            width={680}
        >
            <div className={styles.body}>
                <div className={styles.listToolbar}>
                    <div>
                        <strong>
                            <FormattedMessage
                                defaultMessage="Loaded extensions"
                                id="tw.extensionManager.loadedHeading"
                            />
                        </strong>
                        <span className={styles.summary}>
                            <FormattedMessage
                                defaultMessage="{count} extensions · {totalBlocks} blocks"
                                id="tw.extensionManager.summary"
                                values={{count: extensionIds.length, totalBlocks}}
                            />
                        </span>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            aria-label={props.intl.formatMessage(messages.refresh)}
                            className={styles.iconButton}
                            onClick={handleRefresh}
                            title={props.intl.formatMessage(messages.refresh)}
                        >
                            <RefreshCw />
                        </button>
                    </div>
                </div>

                {extensionIds.length === 0 ? (
                    <div className={styles.state}>
                        <strong>
                            <FormattedMessage
                                defaultMessage="No extensions loaded"
                                id="tw.extensionManager.noneLoaded"
                            />
                        </strong>
                        <span>
                            {props.intl.formatMessage(messages.noneLoadedDescription)}
                        </span>
                    </div>
                ) : (
                    <div className={styles.table}>
                        <div className={styles.tableHeader}>
                            <span>
                                <FormattedMessage
                                    defaultMessage="Extension"
                                    id="tw.extensionManager.extensionColumn"
                                />
                            </span>
                            <span>
                                <FormattedMessage
                                    defaultMessage="Blocks"
                                    id="tw.extensionManager.blocksColumn"
                                />
                            </span>
                            <span />
                        </div>
                        <div className={styles.extensionContainer}>
                            {extensionIds.map((extensionId, index) => {
                                const extensionColor = getExtensionColor(extensionId);
                                const count = blockCounts.get(extensionId) || 0;
                                const sandboxInfo = getExtensionSandboxInfo(extensionId);
                                return (
                                    <div
                                        className={`${styles.extensionRow}${dragIndex === index ? ` ${styles.dragging}` : ''}`}
                                        key={extensionId}
                                        draggable={props.draggable}
                                        data-index={index}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        style={extensionColor ? {borderLeft: `4px solid ${extensionColor}`} : null}
                                    >
                                        <div className={styles.extensionInfo}>
                                            <span
                                                className={styles.extensionIconCircle}
                                                style={extensionColor ? {backgroundColor: extensionColor} : null}
                                            >
                                                {getExtensionIconURL(extensionId) ? (
                                                    <img
                                                        className={styles.extensionIcon}
                                                        src={getExtensionIconURL(extensionId)}
                                                        alt=""
                                                        aria-hidden="true"
                                                        draggable={false}
                                                    />
                                                ) : null}
                                            </span>
                                            <span className={styles.extensionName}>{getExtensionName(extensionId)}</span>
                                            {sandboxInfo && (
                                                <span
                                                    className={styles.sandboxBadge}
                                                    style={{
                                                        backgroundColor: sandboxInfo.color,
                                                        color: '#fff'
                                                    }}
                                                >
                                                    {sandboxInfo.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.blocksCell}>
                                            <strong>{count}</strong>
                                            <span>
                                                {count === 0 ? (
                                                    <FormattedMessage
                                                        defaultMessage="No blocks used"
                                                        id="tw.extensionManager.noBlocks"
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        defaultMessage="blocks"
                                                        id="tw.extensionManager.blocksUnit"
                                                    />
                                                )}
                                            </span>
                                        </div>
                                        <div className={styles.extensionActions}>
                                            <span
                                                className={styles.dragHandle}
                                                onDragStart={stopDragAndClickBubbling}
                                                onMouseDown={stopDragAndClickBubbling}
                                                title={props.intl.formatMessage(messages.dragHint)}
                                            >
                                                <GripVertical />
                                            </span>
                                            <button
                                                aria-label={props.intl.formatMessage(messages.deleteExtension)}
                                                className={`${styles.actionButton} ${styles.deleteButton}`}
                                                onClick={() => requestDeleteExtension(extensionId)}
                                                onDragStart={stopDragAndClickBubbling}
                                                onMouseDown={stopDragAndClickBubbling}
                                                title={props.intl.formatMessage(messages.deleteExtension)}
                                            >
                                                <Trash2 />
                                            </button>
                                            <FancyCheckbox
                                                className={styles.checkboxOption}
                                                checked={selected.includes(extensionId)}
                                                onChange={updateSelection}
                                                value={extensionId}
                                                draggable={false}
                                                onClick={stopDragAndClickBubbling}
                                                onMouseDown={stopDragAndClickBubbling}
                                                onDragStart={stopDragAndClickBubbling}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {extensionIds.length > 0 ? (
                    <div className={styles.footer}>
                        <span>
                            {props.intl.formatMessage(messages.dragHint)}
                        </span>
                        <button
                            className={styles.deleteAllButton}
                            disabled={selected.length === 0}
                            onClick={requestDeleteSelected}
                        >
                            <Trash2 />
                            {props.intl.formatMessage(messages.deleteSelected, {count: selected.length})}
                        </button>
                    </div>
                ) : null}
            </div>
        </Modal>
        {deleteConfirm && (
            <Modal
                centered
                className={styles.confirmModal}
                contentLabel={props.intl.formatMessage(messages.confirmDeleteTitle)}
                height={200}
                id="extensionManagerConfirmDelete"
                minHeight={200}
                minWidth={380}
                onRequestClose={handleCancelDelete}
                resizable={false}
                width={420}
            >
                <div className={styles.confirmBody}>
                    <strong className={styles.confirmTitle}>
                        {props.intl.formatMessage(messages.confirmDeleteTitle)}
                    </strong>
                    <span className={styles.confirmMessage}>
                        {deleteConfirm.ids.length === 1 ?
                            props.intl.formatMessage(messages.confirmDeleteSingle, {
                                name: getExtensionName(deleteConfirm.ids[0]),
                                count: deleteConfirm.blockCount
                            }) :
                            props.intl.formatMessage(messages.confirmDeleteMultiple, {
                                count: deleteConfirm.ids.length,
                                usingCount: deleteConfirm.usingCount,
                                blockCount: deleteConfirm.blockCount
                            })}
                    </span>
                    <div className={styles.confirmActions}>
                        <button
                            className={`${styles.confirmButton} ${styles.confirmCancelButton}`}
                            onClick={handleCancelDelete}
                            type="button"
                        >
                            {props.intl.formatMessage(messages.confirmDeleteNo)}
                        </button>
                        <button
                            className={`${styles.confirmButton} ${styles.confirmOkButton}`}
                            onClick={handleConfirmDelete}
                            type="button"
                        >
                            {props.intl.formatMessage(messages.confirmDeleteYes)}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        </>
    );
};

ExtensionManagerModal.propTypes = {
    intl: intlShape,
    onClose: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        on: PropTypes.func,
        off: PropTypes.func,
        runtime: PropTypes.shape({
            on: PropTypes.func,
            off: PropTypes.func,
            targets: PropTypes.arrayOf(PropTypes.object)
        }),
        extensionManager: PropTypes.shape({
            _loadedExtensions: PropTypes.instanceOf(Map),
            removeExtension: PropTypes.func,
            reorderExtension: PropTypes.func
        })
    }),
    draggable: PropTypes.bool
};

ExtensionManagerModal.defaultProps = {
    draggable: true
};

export default injectIntl(ExtensionManagerModal);
