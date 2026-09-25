/**
 * @file Renders the block previews in the middle click popup (spotlight) by building real
 * ScratchBlocks blocks and cloning their SVG, instead of drawing simplified approximations.
 * Doing it this way means C blocks, nested stacks, fields, fonts and theme colours are
 * identical to what the editor renders.
 *
 * Rendering a block the real way is not cheap, so two things keep typing responsive:
 * - {@link beginPreviewBatch} suspends the workspace resize for the whole batch of previews.
 *   Every created and disposed block would otherwise re-measure the bounding box of the entire
 *   project (O(blocks)), which costs far more than rendering the previews themselves.
 * - Finished previews are cached, so only the rows that actually changed are built again.
 */

import {BlockInstance} from './BlockTypeInfo.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Extra vertical padding, in block units, added above and below a rendered block.
 * @type {number}
 */
const BLOCK_ROW_INSET = 6;

/**
 * How many rendered previews to keep for reuse.
 * @type {number}
 */
const CACHE_LIMIT = 64;

/**
 * Rendered previews, keyed by {@link getPreviewKey}, oldest entry first.
 * Values are `{node, width, height, top, rowHeight}` where `node` is a detached clone.
 * @type {Map<string, object>}
 */
const previewCache = new Map();

/**
 * Stable identity per block type. Block *ids* are not unique enough (every custom block call
 * is a `procedures_call`), so the key has to identify the instance instead.
 * @type {WeakMap<object, number>}
 */
const typeKeys = new WeakMap();
let nextTypeKey = 0;

/**
 * The block colours the cache was rendered with, see {@link getThemeSignature}.
 * @type {string|null}
 */
let themeSignature = null;

let batchDepth = 0;
let batchWorkspace = null;

/**
 * Gets a stable key for a block type.
 * @param {object} typeInfo The block type info.
 * @returns {number} The key.
 */
const getTypeKey = typeInfo => {
    let key = typeKeys.get(typeInfo);
    if (typeof key !== 'number') {
        nextTypeKey++;
        key = nextTypeKey;
        typeKeys.set(typeInfo, key);
    }
    return key;
};

/**
 * Appends everything that changes how a block looks, apart from its type, to `parts`.
 * @param {BlockInstance} blockInstance The block to describe.
 * @param {Array<string|number>} parts The array to append to.
 */
const appendInstanceKey = (blockInstance, parts) => {
    parts.push(getTypeKey(blockInstance.typeInfo));
    const inputs = blockInstance.inputs || [];
    parts.push(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
        const value = inputs[i];
        if (value instanceof BlockInstance) {
            appendInstanceKey(value, parts);
        } else if (value && typeof value === 'object' && 'value' in value) {
            // Dropdown values may be passed as `{value, string}` options or as the value itself.
            parts.push(String(value.value));
        } else if (value && typeof value === 'object') {
            parts.push(JSON.stringify(value));
        } else {
            parts.push(String(value));
        }
    }
};

/**
 * Gets a key describing exactly what a preview will look like.
 * @param {BlockInstance} blockInstance The block to describe.
 * @returns {string} The cache key.
 */
const getPreviewKey = blockInstance => {
    const parts = [themeSignature ?? ''];
    try {
        appendInstanceKey(blockInstance, parts);
    } catch (error) {
        // Anything that can not be described gets its own key, so it is never served stale.
        nextTypeKey++;
        parts.push(`unknown-${nextTypeKey}`);
    }
    return parts.join('\u0001');
};

/**
 * Describes the block colours currently in use. The theme is applied by overwriting
 * `Blockly.Colours` in place, so the values have to be compared instead of the object.
 * @param {*} Blockly The Blockly instance.
 * @returns {string} A signature of the current block colours.
 */
const getThemeSignature = Blockly => {
    const colours = Blockly && Blockly.Colours;
    if (!colours) return '';
    const parts = [];
    for (const name of Object.keys(colours)) {
        const value = colours[name];
        if (value && typeof value === 'object') {
            const keys = Object.keys(value);
            const values = [];
            for (let i = 0; i < keys.length; i++) {
                values.push(value[keys[i]]);
            }
            parts.push(`${name}=${values.join(',')}`);
        } else {
            parts.push(`${name}=${value}`);
        }
    }
    return parts.join(';');
};

/**
 * Drops every cached preview. Called when the block colours change and once the fonts the
 * editor uses have finished loading, as both change how big the rendered blocks are.
 */
const clearPreviewCache = () => {
    previewCache.clear();
};

/**
 * Suspends the workspace resize for a batch of previews and re-measures it once at the end.
 * Creating or disposing a block normally makes ScratchBlocks recompute the bounding box of
 * every top level block in the project, which is much more expensive than the preview itself.
 * This is the same trick the block insert path uses in selectionUtils.js, applied to the whole
 * batch instead of a single block. Also refreshes {@link themeSignature} and drops the cached
 * previews when the block colours changed since the last batch.
 * @param {*} Blockly The Blockly instance.
 * @returns {function(): void} Call once every preview of the batch has been rendered.
 */
const beginPreviewBatch = Blockly => {
    const workspace = Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
    if (!workspace || typeof workspace.setResizesEnabled !== 'function') {
        return () => {};
    }

    const resume = () => {
        batchDepth--;
        if (batchDepth > 0 || !batchWorkspace) return;
        batchDepth = 0;
        const ended = batchWorkspace;
        batchWorkspace = null;
        ended.setResizesEnabled(true);
    };

    const signature = getThemeSignature(Blockly);
    if (signature !== themeSignature) {
        themeSignature = signature;
        clearPreviewCache();
    }

    if (batchDepth === 0) {
        batchWorkspace = workspace;
        workspace.setResizesEnabled(false);
    }
    batchDepth++;
    return resume;
};

/**
 * Removes the Blockly block ids from a cloned SVG subtree. Without this the preview could be
 * picked up by code that looks blocks up in the DOM by their id (e.g. the debugger
 * highlighting), even though the block it refers to no longer exists.
 * @param {SVGElement} element The cloned element to clean up.
 */
const stripBlockIds = element => {
    if (element.hasAttribute('data-id')) {
        element.removeAttribute('data-id');
    }
    const childrenWithIds = element.querySelectorAll('[data-id]');
    for (let i = 0; i < childrenWithIds.length; i++) {
        childrenWithIds[i].removeAttribute('data-id');
    }
};

/**
 * Renders a block, including everything nested inside it, as real ScratchBlocks SVG.
 * @param {BlockInstance} blockInstance The block to render.
 * @param {SVGElement} container The SVG element to render the block into.
 * @param {*} Blockly The Blockly instance.
 * @returns {{dom: SVGElement, width: number, height: number, top: number, rowHeight: number}|null}
 *   The rendered block, or null if it could not be rendered. `width`, `height`, `top` and
 *   `rowHeight` are in unscaled block units.
 */
const createPreview = (blockInstance, container, Blockly) => {
    const holder = container.appendChild(document.createElementNS(SVG_NS, 'g'));
    const content = holder.appendChild(document.createElementNS(SVG_NS, 'g'));

    let block = null;
    // A preview is not part of the project, so it must never produce workspace events.
    // `createWorkspaceForm` builds the same block that clicking the result would insert.
    Blockly.Events.disable();
    try {
        block = blockInstance.createWorkspaceForm();
        const parts = block.getDescendants(false);
        for (let i = 0; i < parts.length; i++) {
            const svgRoot = parts[i].getSvgRoot();
            if (!svgRoot) continue;
            const clone = svgRoot.cloneNode(true);
            stripBlockIds(clone);
            content.appendChild(clone);
        }
    } catch (error) {
        console.warn(`Spotlight: Could not render a preview of "${blockInstance.typeInfo.id}"`, error);
        container.removeChild(holder);
        return null;
    } finally {
        // Takes the block (and its children) back out of the workspace.
        if (block && block.workspace) block.dispose(false, false);
        Blockly.Events.enable();
    }

    let bounds = null;
    try {
        bounds = holder.getBBox();
    } catch (error) {
        // getBBox throws when the container is not rendered, for example when the popup was
        // closed while the search was still running.
        container.removeChild(holder);
        return null;
    }

    if (!bounds.width || !bounds.height) {
        container.removeChild(holder);
        return null;
    }

    // The caller positions `holder`, so counter the block's own origin here.
    content.setAttribute('transform', `translate(${-bounds.x}, ${-bounds.y})`);

    return {
        dom: holder,
        width: bounds.width,
        height: bounds.height,
        top: BLOCK_ROW_INSET,
        rowHeight: bounds.height + (BLOCK_ROW_INSET * 2)
    };
};

/**
 * Renders a block for the popup preview, reusing a cached copy when the same block was already
 * rendered (with the same inputs and the same theme) during an earlier search.
 * @param {BlockInstance} blockInstance The block to render.
 * @param {SVGElement} container The SVG element to render the block into.
 * @param {*} Blockly The Blockly instance.
 * @returns {{dom: SVGElement, width: number, height: number, top: number, rowHeight: number}|null}
 *   The rendered block, or null if it could not be rendered.
 */
const renderPreviewBlock = (blockInstance, container, Blockly) => {
    if (!Blockly || !blockInstance || !blockInstance.typeInfo) return null;

    const key = getPreviewKey(blockInstance);
    const cached = previewCache.get(key);
    if (cached) {
        // Move the entry to the end of the cache so it is the last one to be evicted.
        previewCache.delete(key);
        previewCache.set(key, cached);
        const node = cached.node.cloneNode(true);
        container.appendChild(node);
        return {
            dom: node,
            width: cached.width,
            height: cached.height,
            top: cached.top,
            rowHeight: cached.rowHeight
        };
    }

    const rendered = createPreview(blockInstance, container, Blockly);
    if (!rendered) return null;

    previewCache.set(key, {
        node: rendered.dom.cloneNode(true),
        width: rendered.width,
        height: rendered.height,
        top: rendered.top,
        rowHeight: rendered.rowHeight
    });
    if (previewCache.size > CACHE_LIMIT) {
        previewCache.delete(previewCache.keys().next().value);
    }

    return rendered;
};

if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    // Block previews are sized from measured text, so anything rendered before the editor
    // fonts are ready is not trustworthy.
    document.fonts.ready.then(clearPreviewCache).catch(() => {});
}

export {
    renderPreviewBlock,
    beginPreviewBatch,
    clearPreviewCache,
    BLOCK_ROW_INSET
};
