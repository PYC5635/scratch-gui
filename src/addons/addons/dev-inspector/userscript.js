import WindowManager from '../../window-system/window-manager.js';
import JSONEditor from 'jsoneditor';

export default async function ({ addon, msg, console }) {
  const Blockly = await addon.tab.traps.getBlockly();
  const vm = addon.tab.traps.vm;

  let inspectorWindow = null;
  let projectJSONCache = null;
  let projectJSONCacheString = null;
  let projectJSONEditor = null;
  let blockJSONEditor = null;
  let projectLoaded = false;
  let activePanel = 'overview';
  let currentBlockInfo = null;
  // Filesystem-style navigation: history of visited block ids + path crumbs
  let navHistory = [];
  let navIndex = -1;

  const INPUT_TYPE_NAMES = {
    1: msg('input-value'),
    2: msg('input-statement'),
    3: msg('input-dummy'),
    5: msg('input-end-row')
  };

  const SHAPE_NAMES = {
    boolean: msg('shape-boolean'),
    reporter: msg('shape-reporter'),
    hat: msg('shape-hat'),
    cap: msg('shape-cap'),
    stack: msg('shape-stack')
  };

  // ── helpers ──────────────────────────────────────────────────────────────

  /**
   * jsoneditor textmode.update(json) replaces the document with JSON.stringify(json).
   * Calling update() with no args stringifies undefined -> textarea shows "undefined".
   * Never call update/set without data. Resize only.
   */
  const refreshJSONEditor = editor => {
    if (!editor) return;
    try {
      if (typeof editor.resize === 'function') editor.resize();
    } catch (e) {
      /* ignore */
    }
    try {
      if (editor.aceEditor && typeof editor.aceEditor.resize === 'function') {
        editor.aceEditor.resize(true);
      }
    } catch (e) {
      /* ignore */
    }
  };

  /** Safe write: always pass a real JSON value (never bare undefined). */
  const setEditorJSON = (editor, data) => {
    if (!editor) return;
    const value = data === undefined ? null : data;
    const indent = (editor.options && editor.options.indentation) || 4;
    try {
      // Prefer set(object) so tree mode builds a real graph (not re-parsed text)
      if (typeof editor.set === 'function') {
        editor.set(value);
      } else if (typeof editor.setText === 'function') {
        editor.setText(JSON.stringify(value, null, indent));
      }
      // Expand top level in tree so nested keys are one click away
      if (editor.node && typeof editor.node.expand === 'function') {
        try {
          editor.node.expand(false);
        } catch (e) {
          /* ignore */
        }
      }
      // Code mode: match Ace tab size to indentation
      if (editor.aceEditor && editor.aceEditor.session) {
        try {
          editor.aceEditor.session.setTabSize(indent);
          editor.aceEditor.session.setUseSoftTabs(true);
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      try {
        if (typeof editor.set === 'function') {
          editor.set({$error: String(e && e.message || e)});
        } else if (typeof editor.setText === 'function') {
          editor.setText(JSON.stringify({$error: String(e && e.message || e)}, null, indent));
        }
      } catch (e2) {
        /* ignore */
      }
    }
    refreshJSONEditor(editor);
  };

  const createTextJSONEditor = editorContainer => {
    const editor = new JSONEditor(editorContainer, {
      // Tree = expand/collapse graph; code = raw JSON with highlighting
      mode: 'tree',
      modes: ['tree', 'code'],
      // Wider indent in code/text output (default is 2)
      indentation: 4,
      search: true,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true,
      // Allow editing nested values in tree mode
      onEditable: () => true
    });
    requestAnimationFrame(() => refreshJSONEditor(editor));
    return editor;
  };

  const ensureProjectJSONEditor = editorContainer => {
    if (projectJSONEditor) return;
    projectJSONEditor = createTextJSONEditor(editorContainer);
  };

  const ensureBlockJSONEditor = editorContainer => {
    if (blockJSONEditor) return;
    blockJSONEditor = createTextJSONEditor(editorContainer);
  };

  const observeEditorSize = (editorContainer, getEditor) => {
    if (!editorContainer || typeof ResizeObserver === 'undefined') return;
    if (editorContainer._diResizeObs) return;
    const obs = new ResizeObserver(() => {
      // Resize only - never update() without data
      refreshJSONEditor(getEditor());
    });
    obs.observe(editorContainer);
    editorContainer._diResizeObs = obs;
  };

  const getEditorText = editor => {
    if (!editor) return '';
    if (typeof editor.getText === 'function') return editor.getText();
    try {
      return JSON.stringify(editor.get(), null, 2);
    } catch (e) {
      return '';
    }
  };

  const flashButton = (btn, text, restore, ms = 1600) => {
    const original = restore || btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = text;
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => {
      btn.textContent = original;
    }, ms);
  };

  const escapeHtml = str => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const formatValue = value => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }
    return String(value);
  };

  const shortId = id => {
    if (!id) return '-';
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  };

  const findBlockById = blockId => {
    if (!blockId) return null;
    try {
      const workspace = addon.tab.traps.getWorkspace && addon.tab.traps.getWorkspace();
      if (workspace && workspace.getBlockById) {
        const b = workspace.getBlockById(blockId);
        if (b) return b;
      }
    } catch (e) {
      /* ignore */
    }
    // Flyout / other workspaces
    try {
      if (Blockly && Blockly.Workspace && Blockly.Workspace.getAll) {
        const workspaces = Blockly.Workspace.getAll();
        for (const ws of workspaces) {
          if (ws && ws.getBlockById) {
            const b = ws.getBlockById(blockId);
            if (b) return b;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  };

  const describeConnection = connection => {
    if (!connection) return null;
    const target = connection.targetConnection
      ? connection.targetConnection.getSourceBlock()
      : null;
    return {
      connected: !!connection.targetConnection,
      targetId: target ? target.id : null,
      targetType: target ? target.type : null
    };
  };

  const getProjectJSON = () => {
    if (!vm || !vm.runtime) return null;
    try {
      return JSON.parse(vm.toJSON(undefined, {allowOptimization: false}));
    } catch (e) {
      console.error('Error getting project JSON:', e);
      return null;
    }
  };

  const findBlockInProjectJSON = (projectJson, blockId) => {
    if (!projectJson || !projectJson.targets) return null;
    for (let i = 0; i < projectJson.targets.length; i++) {
      const target = projectJson.targets[i];
      if (target && target.blocks && target.blocks[blockId]) {
        return {block: target.blocks[blockId], target, targetIndex: i};
      }
    }
    return null;
  };

  const findTargetForBlock = blockId => {
    if (!vm || !vm.runtime) return null;
    const targets = vm.runtime.targets || [];
    for (const target of targets) {
      if (target.blocks && target.blocks.getBlock && target.blocks.getBlock(blockId)) {
        return target;
      }
    }
    return vm.editingTarget || null;
  };

  const getShape = block => {
    if (block.outputConnection) {
      if (block.outputConnection.check_ && block.outputConnection.check_.includes('Boolean')) {
        return 'boolean';
      }
      return 'reporter';
    }
    if (block.startHat_) return 'hat';
    if (!block.nextConnection) return 'cap';
    return 'stack';
  };

  // Walk the next-chain from a root block (not into statement inputs)
  const getLinearStack = rootBlock => {
    const list = [];
    let b = rootBlock;
    while (b) {
      list.push(b);
      b = b.getNextBlock ? b.getNextBlock() : null;
    }
    return list;
  };

  // Depth along previous-chain within the same stack segment
  const getStackIndex = block => {
    let idx = 0;
    let b = block;
    while (b && b.getPreviousBlock && b.getPreviousBlock()) {
      b = b.getPreviousBlock();
      idx++;
    }
    return idx;
  };

  const collectFields = block => {
    const fields = [];
    if (!block.inputList) return fields;
    for (const input of block.inputList) {
      if (!input.fieldRow) continue;
      for (const field of input.fieldRow) {
        if (!field.name) continue;
        let value;
        try {
          value = field.getValue();
        } catch (e) {
          value = null;
        }
        let text = value;
        try {
          if (typeof field.getText === 'function') text = field.getText();
        } catch (e) {
          /* ignore */
        }
        fields.push({
          name: field.name,
          value,
          text,
          type: field.constructor ? field.constructor.name : 'Field',
          input: input.name || '(dummy)'
        });
      }
    }
    return fields;
  };

  const collectInputs = block => {
    const inputs = [];
    if (!block.inputList) return inputs;
    for (const input of block.inputList) {
      if (!input.name) continue;
      const conn = describeConnection(input.connection);
      let shadowValue = null;
      if (conn && conn.connected) {
        const target = input.connection.targetConnection.getSourceBlock();
        if (target && target.isShadow && target.isShadow()) {
          // Collect shadow field values for quick reading
          const shadowFields = collectFields(target);
          if (shadowFields.length === 1) {
            shadowValue = shadowFields[0].text;
          } else if (shadowFields.length > 1) {
            shadowValue = shadowFields.map(f => `${f.name}=${f.text}`).join(', ');
          }
        }
      }
      inputs.push({
        name: input.name,
        type: INPUT_TYPE_NAMES[input.type] || String(input.type),
        connected: conn ? conn.connected : false,
        targetId: conn ? conn.targetId : null,
        targetType: conn ? conn.targetType : null,
        shadowValue
      });
    }
    return inputs;
  };

  const getRunningThreads = blockId => {
    if (!vm || !vm.runtime || !vm.runtime.threads) return [];
    return vm.runtime.threads.filter(t => {
      if (!t || !t.stack) return false;
      return t.stack.includes(blockId) || t.topBlock === blockId;
    }).map(t => ({
      topBlock: t.topBlock,
      stack: (t.stack || []).slice(),
      status: t.status,
      stackClick: !!t.stackClick,
      updateMonitor: !!t.updateMonitor,
      targetId: t.target ? t.target.id : null,
      targetName: t.target && t.target.getName ? t.target.getName() : null
    }));
  };

  // ── block info extraction ────────────────────────────────────────────────

  function getBlockInfo (block) {
    if (!block) return null;

    const pos = block.getRelativeToSurfaceXY
      ? block.getRelativeToSurfaceXY()
      : {x: 0, y: 0};

    const parent = block.getParent ? block.getParent() : null;
    const previous = block.getPreviousBlock ? block.getPreviousBlock() : null;
    const next = block.getNextBlock ? block.getNextBlock() : null;
    const root = block.getRootBlock ? block.getRootBlock() : block;
    const surround = block.getSurroundParent ? block.getSurroundParent() : null;

    const children = (block.getChildren ? block.getChildren(false) : []).map(child => ({
      id: child.id,
      type: child.type
    }));

    const linearStack = getLinearStack(root);
    const stackIndex = getStackIndex(block);

    const target = findTargetForBlock(block.id);
    const targetName = target
      ? (target.isStage ? msg('stage') : (target.getName ? target.getName() : target.sprite?.name))
      : null;
    const targetId = target ? target.id : null;

    let vmBlock = null;
    try {
      if (target && target.blocks) {
        vmBlock = target.blocks.getBlock(block.id) || null;
      }
    } catch (e) {
      /* ignore */
    }

    let commentText = null;
    try {
      if (block.comment && typeof block.comment.getText === 'function') {
        commentText = block.comment.getText();
      } else if (vmBlock && vmBlock.comment) {
        const comments = target.comments || {};
        const c = comments[vmBlock.comment];
        if (c) commentText = c.text;
      }
    } catch (e) {
      /* ignore */
    }

    let mutation = null;
    try {
      if (block.mutationToDom) {
        const mutDom = block.mutationToDom();
        if (mutDom) {
          mutation = Blockly.Xml.domToText(mutDom);
        }
      }
      if (vmBlock && vmBlock.mutation) {
        mutation = vmBlock.mutation;
      }
    } catch (e) {
      /* ignore */
    }

    const procedureName = (() => {
      try {
        if (block.type === 'procedures_definition' || block.type === 'procedures_call' ||
            block.type === 'procedures_prototype') {
          const field = block.getField && (block.getField('NAME') || block.getField('PROCCODE'));
          if (field) return field.getValue();
          // Scratch uses mutation proccode
          if (vmBlock && vmBlock.mutation && vmBlock.mutation.proccode) {
            return vmBlock.mutation.proccode;
          }
        }
        if (vmBlock && vmBlock.mutation && vmBlock.mutation.proccode) {
          return vmBlock.mutation.proccode;
        }
      } catch (e) {
        /* ignore */
      }
      return null;
    })();

    const threads = getRunningThreads(block.id);

    const fields = collectFields(block);
    const inputs = collectInputs(block);

    const info = {
      id: block.id,
      type: block.type,
      opcode: (vmBlock && vmBlock.opcode) || block.type,
      shape: SHAPE_NAMES[getShape(block)] || getShape(block),
      category: block.category_ || null,
      colour: block.getColour ? block.getColour() : null,

      position: {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100
      },

      targetId,
      targetName,
      isStage: !!(target && target.isStage),

      parent: parent ? {id: parent.id, type: parent.type} : null,
      previous: previous ? {id: previous.id, type: previous.type} : null,
      next: next ? {id: next.id, type: next.type} : null,
      root: root ? {id: root.id, type: root.type} : null,
      surround: surround ? {id: surround.id, type: surround.type} : null,
      children,

      connections: {
        output: describeConnection(block.outputConnection),
        previous: describeConnection(block.previousConnection),
        next: describeConnection(block.nextConnection)
      },

      flags: {
        shadow: !!(block.isShadow && block.isShadow()),
        insertionMarker: !!(block.isInsertionMarker && block.isInsertionMarker()),
        collapsed: !!(block.isCollapsed && block.isCollapsed()),
        disabled: !!block.disabled,
        movable: block.isMovable ? !!block.isMovable() : true,
        deletable: block.isDeletable ? !!block.isDeletable() : true,
        editable: block.isEditable ? !!block.isEditable() : true,
        topLevel: !!(vmBlock && vmBlock.topLevel) || !parent
      },

      fields,
      inputs,
      comment: commentText,
      mutation,
      procedureName,

      stack: {
        rootId: root ? root.id : block.id,
        rootType: root ? root.type : block.type,
        length: linearStack.length,
        index: stackIndex,
        blocks: linearStack.map((b, i) => ({
          id: b.id,
          type: b.type,
          index: i,
          isCurrent: b.id === block.id
        }))
      },

      threads,

      scratchData: vmBlock ? {
        opcode: vmBlock.opcode,
        inputs: vmBlock.inputs,
        fields: vmBlock.fields,
        next: vmBlock.next,
        parent: vmBlock.parent,
        topLevel: vmBlock.topLevel,
        shadow: vmBlock.shadow,
        x: vmBlock.x,
        y: vmBlock.y,
        mutation: vmBlock.mutation || undefined,
        comment: vmBlock.comment || undefined
      } : null
    };

    return info;
  }

  // ── UI builders ──────────────────────────────────────────────────────────

  /** Clickable block reference (filesystem-style navigation) */
  const blockLink = (id, type, opts = {}) => {
    if (!id) return null;
    const label = opts.label || type || id;
    const idPart = opts.hideId
      ? ''
      : ` <span class="dev-inspector-block-link-id">(${escapeHtml(shortId(id))})</span>`;
    return (
      `<button type="button" class="dev-inspector-block-link" data-block-id="${escapeHtml(id)}" ` +
      `title="${escapeHtml(msg('inspect-title', {type: type || '', id}))}">` +
      `${escapeHtml(label)}${idPart}</button>`
    );
  };

  const propRow = (key, value, opts = {}) => {
    const valClass = opts.plain
      ? 'dev-inspector-prop-val dev-inspector-prop-val-plain'
      : 'dev-inspector-prop-val';
    let display;
    if (value == null || value === '') {
      display = `<span class="dev-inspector-muted">-</span>`;
    } else if (opts.html) {
      display = value;
    } else {
      display = escapeHtml(formatValue(value));
    }
    return `
      <div class="dev-inspector-prop">
        <div class="dev-inspector-prop-key">${escapeHtml(key)}</div>
        <div class="${valClass}">${display}</div>
      </div>
    `;
  };

  const propsTable = rows => {
    // rows: [{key, value, plain?, html?}]
    if (!rows || !rows.length) {
      return `<div class="dev-inspector-empty">${escapeHtml(msg('no-data'))}</div>`;
    }
    return `<div class="dev-inspector-props">${rows.map(r => propRow(r.key, r.value, r)).join('')}</div>`;
  };

  const FLAG_NAMES = {
    shadow: msg('flag-shadow'),
    'top-level': msg('flag-top-level'),
    collapsed: msg('flag-collapsed'),
    disabled: msg('flag-disabled'),
    movable: msg('flag-movable'),
    deletable: msg('flag-deletable'),
    editable: msg('flag-editable'),
    insertion: msg('flag-insertion')
  };

  const flagsHtml = flags => {
    if (!flags) return '';
    const entries = [
      ['shadow', flags.shadow],
      ['top-level', flags.topLevel],
      ['collapsed', flags.collapsed],
      ['disabled', flags.disabled],
      ['movable', flags.movable],
      ['deletable', flags.deletable],
      ['editable', flags.editable],
      ['insertion', flags.insertionMarker]
    ];
    return `
      <div class="dev-inspector-flags">
        ${entries.map(([name, on]) =>
    `<span class="dev-inspector-flag${on ? ' dev-inspector-flag-on' : ''}">${escapeHtml(FLAG_NAMES[name] || name)}</span>`
  ).join('')}
      </div>
    `;
  };

  const refLink = ref => {
    if (!ref || !ref.id) return null;
    return blockLink(ref.id, ref.type);
  };

  /** Local tree: parent (if any) > current > children */
  const renderLocalTree = info => {
    const rows = [];
    if (info.parent) {
      rows.push({
        id: info.parent.id,
        type: info.parent.type,
        depth: 0,
        current: false,
        role: 'parent'
      });
    }
    rows.push({
      id: info.id,
      type: info.type,
      depth: info.parent ? 1 : 0,
      current: true,
      role: 'current'
    });
    const childDepth = (info.parent ? 1 : 0) + 1;
    for (const c of info.children) {
      rows.push({
        id: c.id,
        type: c.type,
        depth: childDepth,
        current: false,
        role: 'child'
      });
    }

    if (rows.length <= 1 && !info.children.length) {
      return `<div class="dev-inspector-empty">${escapeHtml(msg('no-linked-blocks'))}</div>`;
    }

    return `
      <div class="dev-inspector-tree" role="tree">
        ${rows.map(r => {
    const indent = r.depth > 0 ? `${'  '.repeat(r.depth - 1)}└ ` : '';
    const meta = r.role === 'parent'
      ? msg('up')
      : r.role === 'child' ? msg('in') : msg('here');
    if (r.current) {
      return `
            <div class="dev-inspector-tree-row dev-inspector-tree-row-current" role="treeitem" aria-current="true">
              <span class="dev-inspector-tree-indent">${escapeHtml(indent)}</span>
              <span class="dev-inspector-tree-label">${escapeHtml(r.type)}</span>
              <span class="dev-inspector-tree-meta">${meta}</span>
            </div>
          `;
    }
    return `
          <button type="button" class="dev-inspector-tree-row" role="treeitem"
            data-block-id="${escapeHtml(r.id)}"
            title="${escapeHtml(msg('inspect-title', {type: r.type, id: r.id}))}">
            <span class="dev-inspector-tree-indent">${escapeHtml(indent)}</span>
            <span class="dev-inspector-tree-label">${escapeHtml(r.type)}</span>
            <span class="dev-inspector-tree-meta">${meta}</span>
          </button>
        `;
  }).join('')}
      </div>
    `;
  };

  const renderOverview = info => {
    const el = document.createElement('div');
    el.className = 'dev-inspector-panel-scroll';
    el.innerHTML = `
      <h2 class="dev-inspector-section-title">${escapeHtml(msg('overview'))}</h2>
      <p class="dev-inspector-section-sub">${escapeHtml(info.opcode)}${info.procedureName ? ` · ${escapeHtml(info.procedureName)}` : ''}</p>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('identity'))}</div>
        ${propsTable([
    {key: msg('opcode'), value: info.opcode},
    {key: msg('type'), value: info.type},
    {key: msg('block-id'), value: info.id},
    {key: msg('shape'), value: info.shape, plain: true},
    {key: msg('category'), value: info.category},
    {key: msg('procedure'), value: info.procedureName}
  ])}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('location'))}</div>
        ${propsTable([
    {key: msg('target'), value: info.targetName, plain: true},
    {key: msg('target-id'), value: info.targetId},
    {key: msg('position'), value: `(${info.position.x}, ${info.position.y})`},
    {key: msg('top-of-stack'), value: refLink(info.root), html: true},
    {key: msg('stack-index'), value: `${info.stack.index} / ${Math.max(info.stack.length - 1, 0)}`}
  ])}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('browse'))}</div>
        <p class="dev-inspector-section-sub" style="margin:0 0 8px">${escapeHtml(msg('browse-subtext'))}</p>
        ${renderLocalTree(info)}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('flags'))}</div>
        ${flagsHtml(info.flags)}
      </div>

      ${info.comment ? `
        <div class="dev-inspector-block">
          <div class="dev-inspector-block-label">${escapeHtml(msg('comment'))}</div>
          ${propsTable([{key: msg('text'), value: info.comment, plain: true}])}
        </div>
      ` : ''}

      ${info.mutation ? `
        <div class="dev-inspector-block">
          <div class="dev-inspector-block-label">${escapeHtml(msg('mutation'))}</div>
          ${propsTable([{
    key: msg('data'),
    value: typeof info.mutation === 'string' ? info.mutation : JSON.stringify(info.mutation)
  }])}
        </div>
      ` : ''}
    `;
    return el;
  };

  const renderConnections = info => {
    const el = document.createElement('div');
    el.className = 'dev-inspector-panel-scroll';

    const outputConn = info.connections.output;
    const connRows = [
      {key: msg('parent'), value: refLink(info.parent), html: true},
      {key: msg('previous'), value: refLink(info.previous), html: true},
      {key: msg('next'), value: refLink(info.next), html: true},
      {key: msg('surround'), value: refLink(info.surround), html: true},
      {key: msg('root'), value: refLink(info.root), html: true},
      {
        key: msg('output'),
        value: outputConn
          ? (outputConn.connected
            ? blockLink(outputConn.targetId, outputConn.targetType)
            : msg('disconnected'))
          : null,
        html: !!(outputConn && outputConn.connected)
      }
    ];

    let childrenHtml;
    if (!info.children.length) {
      childrenHtml = `<div class="dev-inspector-empty">${escapeHtml(msg('no-child-blocks'))}</div>`;
    } else {
      childrenHtml = `
        <div class="dev-inspector-table-wrap">
          <table class="dev-inspector-table">
            <thead><tr><th>#</th><th>${escapeHtml(msg('type'))}</th><th>${escapeHtml(msg('id'))}</th></tr></thead>
            <tbody>
              ${info.children.map((c, i) => `
                <tr class="dev-inspector-row-link" data-block-id="${escapeHtml(c.id)}" title="${escapeHtml(msg('inspect-title', {type: c.type, id: c.id}))}">
                  <td>${i}</td>
                  <td>${blockLink(c.id, c.type, {hideId: true})}</td>
                  <td>${escapeHtml(c.id)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    el.innerHTML = `
      <h2 class="dev-inspector-section-title">${escapeHtml(msg('connections'))}</h2>
      <p class="dev-inspector-section-sub">${escapeHtml(msg('connections-subtext'))}</p>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('tree'))}</div>
        ${renderLocalTree(info)}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('linked-blocks'))}</div>
        ${propsTable(connRows)}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('children-count', {count: info.children.length}))}</div>
        ${childrenHtml}
      </div>
    `;
    return el;
  };

  const renderInputs = info => {
    const el = document.createElement('div');
    el.className = 'dev-inspector-panel-scroll';

    let fieldsHtml;
    if (!info.fields.length) {
      fieldsHtml = `<div class="dev-inspector-empty">${escapeHtml(msg('no-fields'))}</div>`;
    } else {
      fieldsHtml = `
        <div class="dev-inspector-table-wrap">
          <table class="dev-inspector-table">
            <thead><tr><th>${escapeHtml(msg('name'))}</th><th>${escapeHtml(msg('value'))}</th><th>${escapeHtml(msg('text'))}</th><th>${escapeHtml(msg('type'))}</th></tr></thead>
            <tbody>
              ${info.fields.map(f => `
                <tr>
                  <td>${escapeHtml(f.name)}</td>
                  <td>${escapeHtml(formatValue(f.value))}</td>
                  <td>${escapeHtml(formatValue(f.text))}</td>
                  <td>${escapeHtml(f.type)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let inputsHtml;
    if (!info.inputs.length) {
      inputsHtml = `<div class="dev-inspector-empty">${escapeHtml(msg('no-inputs'))}</div>`;
    } else {
      inputsHtml = `
        <div class="dev-inspector-table-wrap">
          <table class="dev-inspector-table">
            <thead><tr><th>${escapeHtml(msg('name'))}</th><th>${escapeHtml(msg('kind'))}</th><th>${escapeHtml(msg('connected'))}</th><th>${escapeHtml(msg('target-value'))}</th></tr></thead>
            <tbody>
              ${info.inputs.map(inp => {
    let target = '<span class="dev-inspector-muted">-</span>';
    const rowAttrs = inp.connected && inp.targetId
      ? ` class="dev-inspector-row-link" data-block-id="${escapeHtml(inp.targetId)}" title="${escapeHtml(msg('inspect-title', {type: inp.targetType || '', id: inp.targetId}))}"`
      : '';
    if (inp.connected && inp.targetId) {
      const valueHint = inp.shadowValue != null
        ? ` = ${escapeHtml(String(inp.shadowValue))}`
        : '';
      target = `${blockLink(inp.targetId, inp.targetType)}${valueHint}`;
    }
    return `
                  <tr${rowAttrs}>
                    <td>${escapeHtml(inp.name)}</td>
                    <td>${escapeHtml(inp.type)}</td>
                    <td>${inp.connected ? msg('yes') : msg('no')}</td>
                    <td>${target}</td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // VM-level inputs/fields snapshot
    let vmHtml = '';
    if (info.scratchData) {
      const vmFieldEntries = Object.entries(info.scratchData.fields || {});
      const vmInputEntries = Object.entries(info.scratchData.inputs || {});
      vmHtml = `
        <div class="dev-inspector-block">
          <div class="dev-inspector-block-label">${escapeHtml(msg('vm-fields'))}</div>
          ${vmFieldEntries.length ? propsTable(vmFieldEntries.map(([k, v]) => ({
    key: k,
    value: v && typeof v === 'object' && 'value' in v ? v.value : v
  }))) : `<div class="dev-inspector-empty">${escapeHtml(msg('none'))}</div>`}
        </div>
        <div class="dev-inspector-block">
          <div class="dev-inspector-block-label">${escapeHtml(msg('vm-inputs'))}</div>
          ${vmInputEntries.length ? propsTable(vmInputEntries.map(([k, v]) => {
    if (!v) return {key: k, value: '-'};
    const parts = [];
    if (v.block) parts.push(blockLink(v.block, msg('type-block')));
    if (v.shadow && v.shadow !== v.block) parts.push(`${msg('shadow-prefix')}${blockLink(v.shadow, msg('type-shadow'))}`);
    return {
      key: k,
      value: parts.length ? parts.join(' ') : '-',
      html: true
    };
  })) : `<div class="dev-inspector-empty">${escapeHtml(msg('none'))}</div>`}
        </div>
      `;
    }

    el.innerHTML = `
      <h2 class="dev-inspector-section-title">${escapeHtml(msg('inputs-fields'))}</h2>
      <p class="dev-inspector-section-sub">${escapeHtml(msg('inputs-subtext'))}</p>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('fields-count', {count: info.fields.length}))}</div>
        ${fieldsHtml}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('inputs-count', {count: info.inputs.length}))}</div>
        ${inputsHtml}
      </div>

      ${vmHtml}
    `;
    return el;
  };

  const renderStack = info => {
    const el = document.createElement('div');
    el.className = 'dev-inspector-panel-scroll';

    const stack = info.stack;
    let stackHtml;
    if (!stack.blocks.length) {
      stackHtml = `<div class="dev-inspector-empty">${escapeHtml(msg('empty-stack'))}</div>`;
    } else {
      stackHtml = `
        <div class="dev-inspector-table-wrap">
          <table class="dev-inspector-table">
            <thead><tr><th>#</th><th>${escapeHtml(msg('type'))}</th><th>${escapeHtml(msg('id'))}</th></tr></thead>
            <tbody>
              ${stack.blocks.map(b => `
                <tr class="${b.isCurrent ? 'dev-inspector-row-current' : 'dev-inspector-row-link'}"
                  ${b.isCurrent ? '' : `data-block-id="${escapeHtml(b.id)}" title="${escapeHtml(msg('inspect-title', {type: b.type, id: b.id}))}"`}>
                  <td>${b.index}</td>
                  <td>${b.isCurrent
    ? `${escapeHtml(b.type)}  &lt;-`
    : blockLink(b.id, b.type, {hideId: true})}</td>
                  <td>${escapeHtml(b.id)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let threadsHtml;
    if (!info.threads.length) {
      threadsHtml = `<div class="dev-inspector-empty">${escapeHtml(msg('no-running-threads'))}</div>`;
    } else {
      threadsHtml = `
        <div class="dev-inspector-table-wrap">
          <table class="dev-inspector-table">
            <thead><tr><th>${escapeHtml(msg('target'))}</th><th>${escapeHtml(msg('status'))}</th><th>${escapeHtml(msg('stack-depth'))}</th><th>${escapeHtml(msg('top-block'))}</th><th>${escapeHtml(msg('flags'))}</th></tr></thead>
            <tbody>
              ${info.threads.map(t => `
                <tr>
                  <td>${escapeHtml(t.targetName || shortId(t.targetId))}</td>
                  <td>${escapeHtml(String(t.status))}</td>
                  <td>${t.stack.length}</td>
                  <td>${t.topBlock ? blockLink(t.topBlock, msg('type-top')) : '-'}</td>
                  <td>${[
    t.stackClick ? msg('click') : null,
    t.updateMonitor ? msg('monitor') : null
  ].filter(Boolean).join(', ') || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    el.innerHTML = `
      <h2 class="dev-inspector-section-title">${escapeHtml(msg('stack'))}</h2>
      <p class="dev-inspector-section-sub">${escapeHtml(msg('stack-subtext'))}</p>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('summary'))}</div>
        ${propsTable([
    {key: msg('root'), value: blockLink(stack.rootId, stack.rootType), html: true},
    {key: msg('length'), value: String(stack.length), plain: true},
    {key: msg('this-block'), value: msg('index', {n: stack.index}), plain: true},
    {key: msg('surround'), value: refLink(info.surround), html: true}
  ])}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('stack-outline'))}</div>
        <p class="dev-inspector-section-sub" style="margin:0 0 8px">${escapeHtml(msg('stack-outline-subtext'))}</p>
        ${stackHtml}
      </div>

      <div class="dev-inspector-block">
        <div class="dev-inspector-block-label">${escapeHtml(msg('running-threads-count', {count: info.threads.length}))}</div>
        ${threadsHtml}
      </div>
    `;
    return el;
  };

  // ── shell ────────────────────────────────────────────────────────────────

  function createInspectorContent () {
    const container = document.createElement('div');
    container.className = 'dev-inspector-container';
    // Ensure we fill the window content flex area (jsoneditor needs real height)
    container.style.flex = '1 1 0%';
    container.style.minHeight = '0';
    container.style.height = '100%';
    container.innerHTML = `
      <aside class="dev-inspector-sidebar">
        <nav class="dev-inspector-sidebar-nav" aria-label="${escapeHtml(msg('inspector-sections'))}">
          <div class="dev-inspector-group">
            <div class="dev-inspector-group-header">${escapeHtml(msg('inspect'))}</div>
            <button type="button" class="dev-inspector-nav-item dev-inspector-nav-item-active" data-panel="overview">${escapeHtml(msg('overview'))}</button>
            <button type="button" class="dev-inspector-nav-item" data-panel="connections">${escapeHtml(msg('connections'))}</button>
            <button type="button" class="dev-inspector-nav-item" data-panel="inputs">${escapeHtml(msg('inputs'))}</button>
            <button type="button" class="dev-inspector-nav-item" data-panel="stack">${escapeHtml(msg('stack'))}</button>
          </div>
          <div class="dev-inspector-group">
            <div class="dev-inspector-group-header">${escapeHtml(msg('data'))}</div>
            <button type="button" class="dev-inspector-nav-item" data-panel="block-json">${escapeHtml(msg('block-json'))}</button>
            <button type="button" class="dev-inspector-nav-item" data-panel="project-json">${escapeHtml(msg('project-json'))}</button>
          </div>
        </nav>
      </aside>
      <div class="dev-inspector-main">
        <div class="dev-inspector-pathbar">
          <button type="button" class="dev-inspector-path-btn dev-inspector-nav-back" title="${escapeHtml(msg('back'))}" disabled>&#8592;</button>
          <button type="button" class="dev-inspector-path-btn dev-inspector-nav-forward" title="${escapeHtml(msg('forward'))}" disabled>&#8594;</button>
          <button type="button" class="dev-inspector-path-btn dev-inspector-nav-up" title="${escapeHtml(msg('parent-block'))}" disabled>&#8593;</button>
          <div class="dev-inspector-crumbs" aria-label="${escapeHtml(msg('navigation-path'))}"></div>
        </div>
        <div class="dev-inspector-panel dev-inspector-panel-active" data-panel="overview"></div>
        <div class="dev-inspector-panel" data-panel="connections"></div>
        <div class="dev-inspector-panel" data-panel="inputs"></div>
        <div class="dev-inspector-panel" data-panel="stack"></div>
        <div class="dev-inspector-panel" data-panel="block-json">
          <div class="dev-inspector-toolbar">
            <button type="button" class="dev-inspector-copy">${escapeHtml(msg('copy'))}</button>
            <button type="button" class="dev-inspector-download">${escapeHtml(msg('download'))}</button>
            <button type="button" class="dev-inspector-save dev-inspector-btn-primary">${escapeHtml(msg('save-reload'))}</button>
          </div>
          <div class="dev-inspector-editor-wrap">
            <div class="dev-inspector-json-editor"></div>
          </div>
        </div>
        <div class="dev-inspector-panel" data-panel="project-json">
          <div class="dev-inspector-toolbar">
            <button type="button" class="dev-inspector-project-refresh">${escapeHtml(msg('refresh'))}</button>
            <button type="button" class="dev-inspector-project-copy">${escapeHtml(msg('copy'))}</button>
            <button type="button" class="dev-inspector-project-download">${escapeHtml(msg('download'))}</button>
            <button type="button" class="dev-inspector-project-reload dev-inspector-btn-danger">${escapeHtml(msg('reload-project'))}</button>
          </div>
          <div class="dev-inspector-editor-wrap">
            <div class="dev-inspector-project-editor"></div>
          </div>
        </div>
      </div>
    `;

    const navItems = container.querySelectorAll('.dev-inspector-nav-item');
    const panels = container.querySelectorAll('.dev-inspector-panel');
    const blockEditorContainer = container.querySelector('.dev-inspector-json-editor');
    const projectEditorContainer = container.querySelector('.dev-inspector-project-editor');
    const copyBtn = container.querySelector('.dev-inspector-copy');
    const downloadBtn = container.querySelector('.dev-inspector-download');
    const saveBtn = container.querySelector('.dev-inspector-save');
    const projectRefreshBtn = container.querySelector('.dev-inspector-project-refresh');
    const projectCopyBtn = container.querySelector('.dev-inspector-project-copy');
    const projectDownloadBtn = container.querySelector('.dev-inspector-project-download');
    const projectReloadBtn = container.querySelector('.dev-inspector-project-reload');

    const loadProjectJSONAsync = editorContainer => {
      if (!vm || !vm.runtime) {
        ensureProjectJSONEditor(editorContainer);
        setEditorJSON(projectJSONEditor, {$error: msg('vm-not-available')});
        return;
      }
      ensureProjectJSONEditor(editorContainer);
      setEditorJSON(projectJSONEditor, {$status: msg('loading-project-json')});
      requestAnimationFrame(() => {
        try {
          const projectJson = vm.toJSON();
          projectJSONCache = projectJson;
          requestAnimationFrame(() => {
            try {
              const parsed = JSON.parse(projectJson);
              projectJSONCacheString = JSON.stringify(parsed, null, 2);
              setEditorJSON(projectJSONEditor, parsed);
              projectLoaded = true;
            } catch (e) {
              setEditorJSON(projectJSONEditor, {$error: msg('error-parsing-project-json') + e.message});
              console.error('Error parsing project JSON:', e);
            }
          });
        } catch (e) {
          setEditorJSON(projectJSONEditor, {$error: msg('error-loading-project-json') + e.message});
          console.error('Error loading project JSON:', e);
        }
      });
    };

    const setPanel = panelId => {
      activePanel = panelId;
      navItems.forEach(item => {
        item.classList.toggle('dev-inspector-nav-item-active', item.dataset.panel === panelId);
      });
      panels.forEach(panel => {
        panel.classList.toggle('dev-inspector-panel-active', panel.dataset.panel === panelId);
      });

      // Wait for layout so jsoneditor gets a non-zero clientHeight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (panelId === 'block-json') {
            observeEditorSize(blockEditorContainer, () => blockJSONEditor);
            initBlockJSON(container);
            refreshJSONEditor(blockJSONEditor);
          }
          if (panelId === 'project-json') {
            observeEditorSize(projectEditorContainer, () => projectJSONEditor);
            ensureProjectJSONEditor(projectEditorContainer);
            if (!projectLoaded) {
              loadProjectJSONAsync(projectEditorContainer);
            }
            refreshJSONEditor(projectJSONEditor);
          }
        });
      });
    };

    navItems.forEach(item => {
      item.addEventListener('click', () => setPanel(item.dataset.panel));
    });

    copyBtn.addEventListener('click', () => {
      ensureBlockJSONEditor(blockEditorContainer);
      if (!blockJSONEditor) {
        flashButton(copyBtn, msg('not-ready'));
        return;
      }
      navigator.clipboard.writeText(getEditorText(blockJSONEditor)).then(() => {
        flashButton(copyBtn, msg('copied'));
      }).catch(() => flashButton(copyBtn, msg('failed')));
    });

    downloadBtn.addEventListener('click', () => {
      ensureBlockJSONEditor(blockEditorContainer);
      if (!blockJSONEditor) {
        flashButton(downloadBtn, msg('not-ready'));
        return;
      }
      const blockId = currentBlockInfo ? currentBlockInfo.id : 'block';
      const blob = new Blob([getEditorText(blockJSONEditor)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `block-${blockId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    saveBtn.addEventListener('click', async () => {
      ensureBlockJSONEditor(blockEditorContainer);
      if (!blockJSONEditor) {
        flashButton(saveBtn, msg('not-ready'));
        return;
      }
      if (!vm || !vm.runtime || !currentBlockInfo) {
        flashButton(saveBtn, msg('no-block'));
        return;
      }
      try {
        const newBlockData = blockJSONEditor.get();
        const projectJson = getProjectJSON();
        if (!projectJson) {
          flashButton(saveBtn, msg('no-project'));
          return;
        }
        const blockResult = findBlockInProjectJSON(projectJson, currentBlockInfo.id);
        if (!blockResult) {
          flashButton(saveBtn, msg('not-found'));
          return;
        }
        if (JSON.stringify(blockResult.block) === JSON.stringify(newBlockData)) {
          flashButton(saveBtn, msg('no-changes'));
          return;
        }
        blockResult.target.blocks[currentBlockInfo.id] = newBlockData;
        saveBtn.disabled = true;
        flashButton(saveBtn, msg('reloading'), msg('save-reload'), 5000);
        projectJSONCache = null;
        projectJSONCacheString = null;
        projectLoaded = false;
        await vm.runtime.stopAll();
        await vm.loadProject(projectJson);
        flashButton(saveBtn, msg('saved'));
        saveBtn.disabled = false;
      } catch (e) {
        flashButton(saveBtn, msg('invalid-json'));
        saveBtn.disabled = false;
        console.error('Error saving block JSON:', e);
      }
    });

    projectRefreshBtn.addEventListener('click', () => {
      projectJSONCache = null;
      projectJSONCacheString = null;
      projectLoaded = false;
      projectRefreshBtn.disabled = true;
      flashButton(projectRefreshBtn, msg('refreshing'));
      ensureProjectJSONEditor(projectEditorContainer);
      loadProjectJSONAsync(projectEditorContainer);
      setTimeout(() => {
        projectRefreshBtn.disabled = false;
        flashButton(projectRefreshBtn, projectLoaded ? msg('refreshed') : msg('done'));
      }, 200);
    });

    projectCopyBtn.addEventListener('click', () => {
      ensureProjectJSONEditor(projectEditorContainer);
      if (!projectJSONEditor) {
        flashButton(projectCopyBtn, msg('not-ready'));
        return;
      }
      navigator.clipboard.writeText(getEditorText(projectJSONEditor)).then(() => {
        flashButton(projectCopyBtn, msg('copied'));
      }).catch(() => flashButton(projectCopyBtn, msg('failed')));
    });

    projectDownloadBtn.addEventListener('click', () => {
      ensureProjectJSONEditor(projectEditorContainer);
      if (!projectJSONEditor) {
        flashButton(projectDownloadBtn, msg('not-ready'));
        return;
      }
      const blob = new Blob([getEditorText(projectJSONEditor)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    projectReloadBtn.addEventListener('click', async () => {
      try {
        ensureProjectJSONEditor(projectEditorContainer);
        if (!projectJSONEditor) {
          flashButton(projectReloadBtn, msg('not-ready'));
          return;
        }
        if (!vm || !vm.runtime) {
          flashButton(projectReloadBtn, msg('no-vm'));
          return;
        }
        const newProjectData = projectJSONEditor.get();
        projectReloadBtn.disabled = true;
        flashButton(projectReloadBtn, msg('reloading'), msg('reload-project'), 5000);
        projectJSONCache = null;
        projectJSONCacheString = null;
        projectLoaded = false;
        await vm.runtime.stopAll();
        await vm.loadProject(newProjectData);
        flashButton(projectReloadBtn, msg('reloaded'));
        projectReloadBtn.disabled = false;
      } catch (e) {
        flashButton(projectReloadBtn, msg('invalid-json'));
        projectReloadBtn.disabled = false;
        console.error('Error reloading project:', e);
      }
    });

    // Filesystem-style block navigation
    const backBtn = container.querySelector('.dev-inspector-nav-back');
    const forwardBtn = container.querySelector('.dev-inspector-nav-forward');
    const upBtn = container.querySelector('.dev-inspector-nav-up');

    backBtn.addEventListener('click', () => {
      if (navIndex <= 0) return;
      navIndex -= 1;
      const entry = navHistory[navIndex];
      const block = findBlockById(entry.id);
      if (block) {
        showInspector(block, {fromNav: true});
      }
    });
    forwardBtn.addEventListener('click', () => {
      if (navIndex >= navHistory.length - 1) return;
      navIndex += 1;
      const entry = navHistory[navIndex];
      const block = findBlockById(entry.id);
      if (block) {
        showInspector(block, {fromNav: true});
      }
    });
    upBtn.addEventListener('click', () => {
      if (!currentBlockInfo || !currentBlockInfo.parent) return;
      navigateToBlockId(currentBlockInfo.parent.id, {history: 'push'});
    });

    // Event delegation for all block links / tree rows / table rows
    container.addEventListener('click', e => {
      const link = e.target.closest('[data-block-id]');
      if (!link || !container.contains(link)) return;
      // Don't re-navigate to current via tree "here" rows (they have no data-block-id)
      const blockId = link.getAttribute('data-block-id');
      if (!blockId) return;
      if (currentBlockInfo && blockId === currentBlockInfo.id) return;
      e.preventDefault();
      navigateToBlockId(blockId, {history: 'push'});
    });

    container._setPanel = setPanel;
    container._updatePathbar = () => updatePathbar(container);
    return container;
  }

  function updatePathbar (container) {
    if (!container) return;
    const backBtn = container.querySelector('.dev-inspector-nav-back');
    const forwardBtn = container.querySelector('.dev-inspector-nav-forward');
    const upBtn = container.querySelector('.dev-inspector-nav-up');
    const crumbs = container.querySelector('.dev-inspector-crumbs');
    if (!crumbs) return;

    if (backBtn) backBtn.disabled = navIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = navIndex >= navHistory.length - 1 || navIndex < 0;
    if (upBtn) upBtn.disabled = !(currentBlockInfo && currentBlockInfo.parent);

    // Build structural path root -> ... -> current (via parent chain)
    const structural = [];
    if (currentBlockInfo) {
      let cursor = findBlockById(currentBlockInfo.id);
      const seen = new Set();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        structural.unshift({id: cursor.id, type: cursor.type});
        cursor = cursor.getParent ? cursor.getParent() : null;
      }
      // Fallback if Blockly parent chain empty: use history trail
      if (structural.length <= 1 && navHistory.length) {
        structural.length = 0;
        for (let i = 0; i <= navIndex && i < navHistory.length; i++) {
          structural.push(navHistory[i]);
        }
      }
    }

    if (!structural.length) {
      crumbs.innerHTML = `<span class="dev-inspector-muted">${escapeHtml(msg('no-block-selected'))}</span>`;
      return;
    }

    crumbs.innerHTML = structural.map((entry, i) => {
      const isLast = i === structural.length - 1;
      const sep = i > 0 ? `<span class="dev-inspector-crumb-sep">/</span>` : '';
      if (isLast) {
        return `${sep}<span class="dev-inspector-crumb dev-inspector-crumb-current" title="${escapeHtml(entry.id)}">${escapeHtml(entry.type || shortId(entry.id))}</span>`;
      }
      return `${sep}<button type="button" class="dev-inspector-crumb" data-block-id="${escapeHtml(entry.id)}" title="${escapeHtml(entry.id)}">${escapeHtml(entry.type || shortId(entry.id))}</button>`;
    }).join('');
  }

  function navigateToBlockId (blockId, opts = {}) {
    const mode = opts.history || 'push';
    const block = findBlockById(blockId);
    if (!block) {
      console.warn('Dev Inspector: block not found', blockId);
      return;
    }

    const entry = {id: block.id, type: block.type};

    if (mode === 'push') {
      // Drop any forward entries when branching
      if (navIndex < navHistory.length - 1) {
        navHistory = navHistory.slice(0, navIndex + 1);
      }
      // Don't push duplicate of current
      if (!navHistory.length || navHistory[navIndex].id !== entry.id) {
        navHistory.push(entry);
        navIndex = navHistory.length - 1;
      }
    } else if (mode === 'replace') {
      navHistory = [entry];
      navIndex = 0;
    }

    showInspector(block, {fromNav: true});
  }

  function getBlockJSONPayload () {
    if (!currentBlockInfo) return {$error: msg('no-block-selected')};
    try {
      const projectJson = getProjectJSON();
      const blockResult = findBlockInProjectJSON(projectJson, currentBlockInfo.id);
      if (blockResult && blockResult.block) return blockResult.block;
    } catch (e) {
      /* fall through */
    }
    if (currentBlockInfo.scratchData) return currentBlockInfo.scratchData;
    return {
      id: currentBlockInfo.id,
      opcode: currentBlockInfo.opcode,
      fields: currentBlockInfo.fields,
      inputs: currentBlockInfo.inputs
    };
  }

  function initBlockJSON (container) {
    const blockEditorContainer = container.querySelector('.dev-inspector-json-editor');
    if (!blockEditorContainer) return;

    // Recreate if a prior instance was built while the host had no size
    // (jsoneditor measures container once; a 0-height host leaves a dead editor).
    if (blockJSONEditor && blockEditorContainer.clientHeight > 0) {
      const frame = blockEditorContainer.querySelector('.jsoneditor');
      if (frame && frame.clientHeight < 80) {
        try {
          if (typeof blockJSONEditor.destroy === 'function') blockJSONEditor.destroy();
        } catch (e) {
          /* ignore */
        }
        blockJSONEditor = null;
        blockEditorContainer.innerHTML = '';
      }
    }

    ensureBlockJSONEditor(blockEditorContainer);
    if (!blockJSONEditor || !currentBlockInfo) return;

    setEditorJSON(blockJSONEditor, getBlockJSONPayload());
  }

  function fillInfoPanels (container, info) {
    const overview = container.querySelector('.dev-inspector-panel[data-panel="overview"]');
    const connections = container.querySelector('.dev-inspector-panel[data-panel="connections"]');
    const inputs = container.querySelector('.dev-inspector-panel[data-panel="inputs"]');
    const stack = container.querySelector('.dev-inspector-panel[data-panel="stack"]');

    overview.innerHTML = '';
    connections.innerHTML = '';
    inputs.innerHTML = '';
    stack.innerHTML = '';

    overview.appendChild(renderOverview(info));
    connections.appendChild(renderConnections(info));
    inputs.appendChild(renderInputs(info));
    stack.appendChild(renderStack(info));

    if (container._updatePathbar) {
      container._updatePathbar();
    }
  }

  function showInspector (block, opts = {}) {
    const blockInfo = getBlockInfo(block);
    if (!blockInfo) return;
    currentBlockInfo = blockInfo;

    // Fresh open from context menu: reset history to this block
    if (!opts.fromNav) {
      navHistory = [{id: blockInfo.id, type: blockInfo.type}];
      navIndex = 0;
    }

    if (inspectorWindow) {
      inspectorWindow.show().bringToFront();
    } else {
      const cleanup = () => {
        inspectorWindow = null;
        projectJSONCache = null;
        projectJSONCacheString = null;
        projectLoaded = false;
        currentBlockInfo = null;
        navHistory = [];
        navIndex = -1;
        if (projectJSONEditor) {
          try {
            projectJSONEditor.destroy();
          } catch (e) {
            /* ignore */
          }
          projectJSONEditor = null;
        }
        if (blockJSONEditor) {
          try {
            blockJSONEditor.destroy();
          } catch (e) {
            /* ignore */
          }
          blockJSONEditor = null;
        }
      };

      inspectorWindow = WindowManager.createWindow({
        id: 'dev-inspector',
        title: msg('window-title'),
        width: 720,
        height: 560,
        minWidth: 420,
        minHeight: 320,
        maxWidth: 1400,
        maxHeight: 1000,
        className: 'dev-inspector-window',
        destroyOnMinimize: true,
        onClose: cleanup,
        onMinimize: cleanup
      });

      const content = createInspectorContent();
      inspectorWindow.setContent(content);
      inspectorWindow.show();
    }

    const container = inspectorWindow.element.querySelector('.dev-inspector-container');
    fillInfoPanels(container, blockInfo);

    if (typeof inspectorWindow.setTitle === 'function') {
      inspectorWindow.setTitle(`${msg('window-title')} - ${blockInfo.opcode}`);
    }

    // Refresh JSON if that panel is active
    if (activePanel === 'block-json') {
      initBlockJSON(container);
    }

    // Keep current panel selection
    if (container._setPanel) {
      container._setPanel(activePanel);
    }
  }

  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (addon.self.disabled) return items;

      const inspectIndex = items.findIndex(obj => obj._isDevtoolsFirstItem);
      const insertBeforeIndex = inspectIndex !== -1 ? inspectIndex : items.length;

      items.splice(insertBeforeIndex, 0, {
        enabled: true,
        text: msg('inspect-block'),
        callback: () => {
          showInspector(block);
        },
        separator: true
      });

      return items;
    },
    {blocks: true}
  );
}
