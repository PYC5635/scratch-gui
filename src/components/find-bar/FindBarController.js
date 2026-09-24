import BlockItem from '../../lib/find-bar/BlockItem';
import {getItem as getStorageItem} from '../../lib/utils/safe-storage.js';
import {getCodeSearch, setFindBarApi} from '../../lib/find-bar/api';

import Dropdown from './Dropdown';

// Opcode -> scratch-blocks message key remapping for blocks whose opcode has
// underscores that the message table does not.
const operatorMap = {
    'OPERATORS_LETTER_OF': 'OPERATORS_LETTEROF',
    'OPERATORS_LETTERS_OF': 'OPERATORS_LETTERSOF',
    'OPERATORS_INDEX_OF': 'OPERATORS_INDEXOF',
    'OPERATORS_CHANGE_CASE': 'OPERATORS_CHANGECASE'
};

const normalizeType = type => {
    const upper = type.toUpperCase();
    if (upper.startsWith('OPERATOR')) {
        const mapped = 'OPERATORS' + upper.slice(8);
        return operatorMap[mapped] || mapped;
    }
    if (upper === 'SOUND_SETEFFECTTO') return 'SOUND_SETEFFECTO';
    const controlMap = {
        'CONTROL_WAIT_UNTIL': 'CONTROL_WAITUNTIL',
        'CONTROL_REPEAT_UNTIL': 'CONTROL_REPEATUNTIL',
        'CONTROL_FOR_EACH': 'CONTROL_FOREACH',
        'CONTROL_START_AS_CLONE': 'CONTROL_STARTASCLONE',
        'CONTROL_CREATE_CLONE_OF': 'CONTROL_CREATECLONEOF',
        'CONTROL_DELETE_THIS_CLONE': 'CONTROL_DELETETHISCLONE',
        'CONTROL_INCR_COUNTER': 'CONTROL_INCRCOUNTER',
        'CONTROL_CLEAR_COUNTER': 'CONTROL_CLEARCOUNTER',
        'CONTROL_ALL_AT_ONCE': 'CONTROL_ALLATONCE',
        'CONTROL_GET_COUNTER': 'CONTROL_COUNTER'
    };
    if (controlMap[upper]) return controlMap[upper];
    return upper;
};

const getMessages = (ScratchBlocks, blockJson) => [
    ScratchBlocks.Msg,
    Object.fromEntries(
        blockJson.flatMap(b => {
            if (!b) return [];
            const normalizedType = normalizeType(b.type);
            const messages = [];
            let i = 0;
            while (b[`message${i}`] !== undefined) {
                messages.push(b[`message${i}`]);
                i++;
            }
            if (messages.length === 0) return [];

            let text = messages.join(' ');

            // Extension blocks that render an icon (pen, music, ...) have their
            // message prefixed with "%1 %2" placeholders mapping to the icon and
            // a vertical separator. Strip them so the real translated text is
            // left over, otherwise the search results would show "() ()text".
            if (b.args0 && b.args0[0] && b.args0[0].type === 'field_image') {
                text = text.replace(/^\s*%\d+(?:\s*%\d+)*/, '').trim();
            }

            if (!text) return [];
            return [[normalizedType, text]];
        })
    )
];

const getColours = blockJson => Object.fromEntries(
    blockJson.flatMap(b => {
        if (!b) return [];
        const normalizedType = normalizeType(b.type);
        return [[normalizedType, b.colour]];
    })
);

export default class FindBarController {
    constructor ({ScratchBlocks, utils, vm, msg, msgAny, inputClassName, activeTabIndexRef, isPlayerOnlyRef}) {
        this.ScratchBlocks = ScratchBlocks;
        this.utils = utils;
        this.vm = vm;
        this.msg = msg;
        this.msgAny = msgAny;
        this.inputClassName = inputClassName;
        this.activeTabIndexRef = activeTabIndexRef;
        this.isPlayerOnlyRef = isPlayerOnlyRef;

        this.prevValue = '';

        this.currentResults = [];
        this.currentResultIndex = -1;

        this.isRegexMode = false;
        this.isCaseSensitive = getStorageItem('sa-find-case-sensitive') === '1';

        this.findBarOuter = null;
        this.findWrapper = null;
        this.findInput = null;
        this.codeResults = [];
        this.codeIndex = 0;
        this.codeSearchToken = 0;
        this.dropdownOut = null;
        this.dropdown = new Dropdown({ScratchBlocks, utils, vm, msg});
        this.searchControls = null;

        this._onDocumentKeyDown = e => this.eventKeyDown(e);
        document.addEventListener('keydown', this._onDocumentKeyDown, true);

        this._onDocumentPointerDown = e => {
            if (!this.findBarOuter || !this.findBarOuter.classList.contains('mw-find-expanded')) return;
            if (this.findBarOuter.contains(e.target)) return;
            this.collapseMobileSearch();
        };
        document.addEventListener('pointerdown', this._onDocumentPointerDown, true);

        this._cachedScratchBlocks = null;
        this._cachedScratchCostumes = null;
        this._cachedScratchSounds = null;
        this._cachedColours = null;
        this._cachedMessages = null;
        this._debounceTimer = null;
        this._searchChunkRaf = null;

        this._invalidateOnVmChange = () => this._invalidateCache();
        this.vm.on('PROJECT_CHANGED', this._invalidateOnVmChange);
        this.vm.on('workspaceUpdate', this._invalidateOnVmChange);
    }

    get workspace () {
        return this.ScratchBlocks.getMainWorkspace();
    }

    _debounce (func, delay) {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(func, delay);
    }

    _invalidateCache () {
        this._cachedScratchBlocks = null;
        this._cachedScratchCostumes = null;
        this._cachedScratchSounds = null;
        this._cachedColours = null;
        this._cachedMessages = null;
    }

    createDom (root) {
        if (this.findBarOuter) return;

        this.findBarContainer = document.createElement('li');
        this.findBarContainer.className = 'mw-native-find-bar-container';
        this.findBarContainer.setAttribute('role', 'presentation');
        root.appendChild(this.findBarContainer);

        this.findBarOuter = document.createElement('div');
        this.findBarOuter.className = 'sa-find-bar mw-native-find-bar';
        this.findBarContainer.appendChild(this.findBarOuter);

        this.findWrapper = this.findBarOuter.appendChild(document.createElement('span'));
        this.findWrapper.className = 'sa-find-wrapper';

        this.searchIcon = this.findWrapper.appendChild(document.createElement('span'));
        this.searchIcon.className = 'sa-find-icon';
        this.searchIcon.setAttribute('aria-hidden', 'true');
        this.searchIcon.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
                <path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;

        this.searchIcon.addEventListener('click', () => {
            if (this.findBarOuter.classList.contains('mw-find-expanded')) {
                this.collapseMobileSearch();
            } else {
                this.findBarOuter.classList.add('mw-find-expanded');
                if (this.findInput) this.findInput.focus();
            }
        });

        this.dropdownOut = this.findWrapper.appendChild(document.createElement('label'));
        this.dropdownOut.className = 'sa-find-dropdown-out';

        const inputWrap = this.dropdownOut.appendChild(document.createElement('span'));
        inputWrap.className = 'sa-find-input-wrap';

        this.findInput = inputWrap.appendChild(document.createElement('input'));
        this.findInput.className = `${this.inputClassName} sa-find-input`;
        this.findInput.id = 'sa-find-input';
        this.findInput.type = 'search';
        this.findInput.placeholder = this.msg('find-placeholder');
        this.findInput.autocomplete = 'off';

        this.dropdownOut.appendChild(this.dropdown.createDom());

        this.searchControls = this.findBarOuter.appendChild(document.createElement('div'));
        this.searchControls.className = 'sa-hidden-modifiers';

        this.caseToggle = this.searchControls.appendChild(document.createElement('button'));
        this.caseToggle.className = `sa-find-toggle${this.isCaseSensitive ? ' sa-find-toggle-active' : ''}`;
        this.caseToggle.textContent = 'Aa';
        this.caseToggle.title = this.msg('case-sensitive');
        this.caseToggle.type = 'button';
        this.caseToggle.addEventListener('click', e => {
            e.preventDefault();
            this.toggleCaseSensitive();
            this.findInput.focus();
        });

        this.regexToggle = this.searchControls.appendChild(document.createElement('button'));
        this.regexToggle.className = `sa-find-toggle${this.isRegexMode ? ' sa-find-toggle-active' : ''}`;
        this.regexToggle.textContent = '.*';
        this.regexToggle.title = this.msg('regex-mode');
        this.regexToggle.type = 'button';
        this.regexToggle.addEventListener('click', e => {
            e.preventDefault();
            this.toggleRegexMode();
            this.findInput.focus();
        });

        this.searchStats = this.findWrapper.appendChild(document.createElement('span'));
        this.searchStats.className = 'sa-find-stats';

        this.bindEvents();
        this.tabChanged();

        setFindBarApi({
            expand: () => this.expandMobileSearch(),
            collapse: () => this.collapseMobileSearch()
        });
    }

    destroy () {
        setFindBarApi(null);
        document.removeEventListener('keydown', this._onDocumentKeyDown, true);
        document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
        this.vm.removeListener('PROJECT_CHANGED', this._invalidateOnVmChange);
        this.vm.removeListener('workspaceUpdate', this._invalidateOnVmChange);
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
        if (this._searchChunkRaf) {
            cancelAnimationFrame(this._searchChunkRaf);
            this._searchChunkRaf = null;
        }
        if (this.findBarOuter) {
            this.findBarOuter.remove();
            this.findBarOuter = null;
        }
        if (this.findBarContainer) {
            this.findBarContainer.remove();
            this.findBarContainer = null;
        }
    }

    bindEvents () {
        this.findInput.addEventListener('focus', () => {
            this.updateModifierVisibility();
            if (getCodeSearch()) {
                if (this.findInput.value) this.inputChange({skipDebounce: true});
                return;
            }
            this.showDropDown();
            if (this.findInput.value) {
                this.inputChange({skipDebounce: true});
            } else {
                this.showAllItems();
            }
        });

        this.findInput.addEventListener('blur', () => {
            setTimeout(() => this.updateModifierVisibility(), 0);
            this.hideDropDown();
        });

        this.findInput.addEventListener('keydown', e => this.inputKeyDown(e));
        this.findInput.addEventListener('keyup', () => this.inputChange());

        this.findBarOuter.addEventListener('mousedown', e => {
            if (e.target === this.caseToggle || e.target === this.regexToggle) {
                e.preventDefault();
            }
        });
    }

    updateModifierVisibility () {
        const inputFocused = document.activeElement === this.findInput;
        if (inputFocused) {
            this.searchControls.classList.add('sa-find-controls');
        } else {
            this.searchControls.classList.remove('sa-find-controls');
        }
    }

    tabChanged () {
        if (!this.findBarOuter) return;
        const tab = this.activeTabIndexRef.current;
        const visible = tab === 0 || tab === 1 || tab === 2;
        this.findBarOuter.hidden = !visible;
        if (!visible) {
            this._invalidateCache();
            this.dropdown.empty();
        }
    }

    clearChildren (element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    appendHighlightedText (container, text, matchIndex, matchLength) {
        if (matchIndex > 0) {
            container.appendChild(document.createTextNode(text.substring(0, matchIndex)));
        }

        const bText = document.createElement('b');
        bText.appendChild(document.createTextNode(text.substr(matchIndex, matchLength)));
        container.appendChild(bText);

        if (matchIndex + matchLength < text.length) {
            container.appendChild(document.createTextNode(text.substr(matchIndex + matchLength)));
        }
    }

    getSearchRegex (pattern) {
        if (!this.isRegexMode) return null;
        try {
            return new RegExp(pattern, this.isCaseSensitive ? 'g' : 'gi');
        } catch (e) {
            return null;
        }
    }

    findMatch ({displayName, procCode, opcode, searchNeedle, regex}) {
        const primaryText = displayName || procCode;

        if (regex) {
            let match = regex.exec(primaryText);
            if (match) {
                regex.lastIndex = 0;
                return {matchIndex: match.index, matchLength: match[0].length, matchInOpcode: false};
            }

            if (procCode && procCode !== primaryText) {
                regex.lastIndex = 0;
                match = regex.exec(procCode);
                regex.lastIndex = 0;
                if (match) {
                    return {matchIndex: match.index, matchLength: match[0].length, matchInOpcode: true};
                }
            }

            if (opcode) {
                regex.lastIndex = 0;
                match = regex.exec(opcode);
                regex.lastIndex = 0;
                if (match) {
                    return {matchIndex: match.index, matchLength: match[0].length, matchInOpcode: true};
                }
            }

            return null;
        }

        const primarySearchText = this.isCaseSensitive ? primaryText : primaryText.toLowerCase();
        let matchIndex = primarySearchText.indexOf(searchNeedle);
        if (matchIndex >= 0) {
            return {matchIndex, matchLength: searchNeedle.length, matchInOpcode: false};
        }

        if (procCode && procCode !== primaryText) {
            const procSearchText = this.isCaseSensitive ? procCode : procCode.toLowerCase();
            matchIndex = procSearchText.indexOf(searchNeedle);
            if (matchIndex >= 0) {
                return {matchIndex, matchLength: searchNeedle.length, matchInOpcode: true};
            }
        }

        if (opcode) {
            const opcodeSearchText = this.isCaseSensitive ? opcode : opcode.toLowerCase();
            matchIndex = opcodeSearchText.indexOf(searchNeedle);
            if (matchIndex >= 0) {
                return {matchIndex, matchLength: searchNeedle.length, matchInOpcode: true};
            }
        }

        return null;
    }

    inputChange (options = {}) {
        const codeSearch = getCodeSearch();
        if (codeSearch) {
            const query = this.findInput.value;
            codeSearch.search(query, this.isCaseSensitive);
            if (!query) {
                this.showCodeResults([]);
                return;
            }
            const token = ++this.codeSearchToken;
            codeSearch.searchAll(query, this.isCaseSensitive).then(results => {
                if (token === this.codeSearchToken) this.showCodeResults(results);
            });
            return;
        }

        if (!this.findInput.value) {
            this.showAllItems();
            return;
        }

        const val = this.findInput.value;
        const searchVal = this.isCaseSensitive ? val : val.toLowerCase();

        const performSearch = () => {
            if (searchVal === this.prevValue) {
                return;
            }
            this._performSearch(searchVal, val);
        };

        if (options.skipDebounce) {
            performSearch();
        } else {
            this._debounce(performSearch, 20);
        }
    }

    _performSearch (searchVal, originalVal) {
        this.prevValue = searchVal;
        this.showDropDown();

        const regex = this.getSearchRegex(originalVal);

        const listLI = this.dropdown.items;

        // Cancel any in-flight chunked search so a stale query never keeps
        // touching the DOM after the user has typed something else.
        if (this._searchChunkRaf) {
            cancelAnimationFrame(this._searchChunkRaf);
            this._searchChunkRaf = null;
        }

        // On big projects the result list can hold hundreds of <li> entries.
        // Rebuilding every match synchronously can freeze the page, so spread
        // the work across animation frames once the list is large enough.
        const SEARCH_CHUNK_SIZE = 250;
        let index = 0;
        const processChunk = () => {
            const end = Math.min(index + SEARCH_CHUNK_SIZE, listLI.length);
            for (; index < end; index++) {
                const li = listLI[index];
                const procCode = li.data.procCode;
                const opcode = li.data.opcode;
                const displayName = li.displayName || procCode;
                const match = this.findMatch({displayName, procCode, opcode, searchNeedle: searchVal, regex});

                if (match) {
                    li.style.display = 'block';

                    this.clearChildren(li);

                    if (match.matchInOpcode && opcode) {
                        li.appendChild(document.createTextNode(displayName));
                        li.appendChild(document.createTextNode(' ('));

                        const opcodeSpan = document.createElement('span');
                        opcodeSpan.className = 'sa-find-opcode';

                        this.appendHighlightedText(opcodeSpan, opcode, match.matchIndex, match.matchLength);

                        li.appendChild(opcodeSpan);
                        li.appendChild(document.createTextNode(')'));
                    } else {
                        this.appendHighlightedText(li, displayName, match.matchIndex, match.matchLength);
                    }
                } else {
                    li.style.display = 'none';
                }
            }
            if (index < listLI.length) {
                this._searchChunkRaf = requestAnimationFrame(processChunk);
            } else {
                this._searchChunkRaf = null;
            }
        };

        if (listLI.length > SEARCH_CHUNK_SIZE) {
            this._searchChunkRaf = requestAnimationFrame(processChunk);
        } else {
            processChunk();
        }
    }

    showAllItems () {
        this.showDropDown();
        const listLI = this.dropdown.items;

        for (const li of listLI) {
            if (li.data && li.data.isTextInputEntry) {
                li.style.display = 'none';
                continue;
            }
            li.style.display = 'block';

            const displayName = li.displayName;
            this.clearChildren(li);
            li.appendChild(document.createTextNode(displayName));
        }
    }

    showCodeResults (results) {
        this.dropdown.empty();
        this.codeResults = results;
        this.codeIndex = 0;
        if (!results.length) {
            this.hideDropDown();
            return;
        }
        for (const result of results) {
            const item = document.createElement('li');
            item.className = 'sa-find-code-result';

            const where = document.createElement('span');
            where.className = 'sa-find-code-where';
            where.textContent = `${result.filepath}:${result.line}`;

            const preview = document.createElement('span');
            preview.className = 'sa-find-code-preview';
            preview.textContent = result.preview;

            item.appendChild(where);
            item.appendChild(preview);
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                const codeSearch = getCodeSearch();
                if (codeSearch) codeSearch.open(result);
                this.findInput.blur();
            });

            this.dropdown.items.push(item);
            this.dropdown.el.appendChild(item);
        }
        this.selectCodeResult(0);
        this.showDropDown();
    }

    selectCodeResult (index) {
        const items = this.dropdown.items;
        if (!items.length) return;
        const wrapped = ((index % items.length) + items.length) % items.length;
        this.codeIndex = wrapped;
        items.forEach((item, i) => item.classList.toggle('sel', i === wrapped));
        items[wrapped].scrollIntoView({block: 'nearest'});
    }

    inputKeyDown (e) {
        const codeSearch = getCodeSearch();
        if (codeSearch) {
            const results = this.codeResults || [];
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (results.length) {
                    this.selectCodeResult(this.codeIndex + (e.key === 'ArrowDown' ? 1 : -1));
                    e.preventDefault();
                }
            } else if (e.key === 'Enter') {
                if (results[this.codeIndex]) {
                    codeSearch.open(results[this.codeIndex]);
                    this.findInput.blur();
                } else {
                    codeSearch.step(e.shiftKey ? -1 : 1);
                }
                e.preventDefault();
            } else if (e.key === 'F3') {
                codeSearch.step(e.shiftKey ? -1 : 1);
                e.preventDefault();
            } else if (e.key === 'Escape') {
                this.findInput.value = '';
                codeSearch.search('', this.isCaseSensitive);
                this.showCodeResults([]);
                this.findInput.blur();
                e.preventDefault();
            }
            return;
        }

        this.dropdown.inputKeyDown(e);

        if (e.key === 'F3') {
            this.navigateResults(e.shiftKey ? -1 : 1);
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            this.findInput.blur();
            return;
        }

        if (e.key === 'Escape') {
            if (this.findInput.value.length > 0) {
                this.findInput.value = '';
                this.inputChange();
            } else {
                this.findInput.blur();
                this.collapseMobileSearch();
            }
            e.preventDefault();
            return;
        }
    }

    collapseMobileSearch () {
        if (!this.findBarOuter) return;
        this.findBarOuter.classList.remove('mw-find-expanded');
    }

    expandMobileSearch () {
        if (!this.findBarOuter) return;
        this.findBarOuter.classList.add('mw-find-expanded');
        if (this.findInput) this.findInput.focus();
    }

    toggleCaseSensitive () {
        this.isCaseSensitive = !this.isCaseSensitive;
        localStorage.setItem('sa-find-case-sensitive', this.isCaseSensitive ? '1' : '0');
        this.caseToggle.classList.toggle('sa-find-toggle-active', this.isCaseSensitive);
        this.prevValue = null;
        this.inputChange();
    }

    toggleRegexMode () {
        this.isRegexMode = !this.isRegexMode;
        this.regexToggle.classList.toggle('sa-find-toggle-active', this.isRegexMode);
        this.prevValue = null;
        this.inputChange();
    }

    navigateResults (direction) {
        const visibleItems = this.dropdown.items.filter(item => item.style.display !== 'none');
        if (visibleItems.length === 0) return;

        let currentIndex = visibleItems.indexOf(this.dropdown.selected);
        if (currentIndex === -1) {
            currentIndex = direction > 0 ? -1 : 0;
        }

        const newIndex = (currentIndex + direction + visibleItems.length) % visibleItems.length;
        this.dropdown.onItemClick(visibleItems[newIndex]);
        visibleItems[newIndex].scrollIntoView({block: 'nearest'});
    }

    eventKeyDown (e) {
        if (this.isPlayerOnlyRef.current || !this.findBarOuter) return;

        const ctrlKey = e.ctrlKey || e.metaKey;

        if (e.key.toLowerCase() === 'f' && ctrlKey && !e.shiftKey) {
            this.findInput.focus();
            this.findInput.select();
            e.cancelBubble = true;
            e.preventDefault();
            return true;
        }

        if (e.key === 'ArrowLeft' && ctrlKey) {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                return;
            }

            if (this.activeTabIndexRef.current === 0) {
                this.utils.navigationHistory.goBack();
                e.cancelBubble = true;
                e.preventDefault();
                return true;
            }
        }

        if (e.key === 'ArrowRight' && ctrlKey) {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                return;
            }

            if (this.activeTabIndexRef.current === 0) {
                this.utils.navigationHistory.goForward();
                e.cancelBubble = true;
                e.preventDefault();
                return true;
            }
        }
    }

    showDropDown (focusID, instanceBlock) {
        const hasValue = this.findInput.value && this.dropdown.items.length > 0;
        if (!focusID && this.dropdownOut.classList.contains('visible') && hasValue) {
            return;
        }

        this.prevValue = focusID ? '' : null;

        this.dropdownOut.classList.add('visible');

        let scratchBlocks;
        const tabIndex = this.activeTabIndexRef.current;

        switch (tabIndex) {
        case 0:
            if (this._cachedScratchBlocks) {
                scratchBlocks = this._cachedScratchBlocks;
            } else {
                scratchBlocks = this.getScratchBlocks();
                this._cachedScratchBlocks = scratchBlocks;
            }
            break;
        case 1:
            if (this._cachedScratchCostumes && this._cachedScratchCostumes.length > 0) {
                scratchBlocks = this._cachedScratchCostumes;
            } else {
                scratchBlocks = this.getScratchCostumes();
                this._cachedScratchCostumes = scratchBlocks;
            }
            break;
        case 2:
            if (this._cachedScratchSounds && this._cachedScratchSounds.length > 0) {
                scratchBlocks = this._cachedScratchSounds;
            } else {
                scratchBlocks = this.getScratchSounds();
                this._cachedScratchSounds = scratchBlocks;
            }
            break;
        default:
            scratchBlocks = [];
            break;
        }

        this.dropdown.empty();

        let blockJson;
        let colours;
        let messagesList;
        if (this._cachedColours && this._cachedMessages) {
            colours = this._cachedColours;
            messagesList = this._cachedMessages;
        } else {
            blockJson = this.vm.runtime.getBlocksJSON();
            colours = getColours(blockJson);
            messagesList = getMessages(this.ScratchBlocks, blockJson);
            this._cachedColours = colours;
            this._cachedMessages = messagesList;
        }

        for (const proc of scratchBlocks) {
            const item = this.dropdown.addItem(proc, messagesList, colours);

            if (focusID) {
                if (proc.matchesID(focusID)) {
                    this.dropdown.onItemClick(item, instanceBlock);
                } else {
                    item.style.display = 'none';
                }
            }
        }

        this.utils.offsetX = this.dropdownOut.getBoundingClientRect().width + 32;
        this.utils.offsetY = 32;
    }

    hideDropDown () {
        this.dropdownOut.classList.remove('visible');
    }

    getScratchBlocks () {
        const myBlocks = [];
        const myBlocksByProcCode = {};

        const target = this.utils.getEditingTarget();
        const vmBlocks = target && target.blocks && target.blocks._blocks;
        if (!vmBlocks) return myBlocks;

        const workspace = this.workspace;
        if (!workspace) return myBlocks;

        const spriteName = target.sprite ? target.sprite.name : null;
        const isCurrentSprite = true;

        const addBlock = (cls, txt, idOrBlock, opcode = null, y = null) => {
            const id = (typeof idOrBlock === 'object' && idOrBlock !== null) ?
                (idOrBlock.id || (typeof idOrBlock.getId === 'function' ? idOrBlock.getId() : null)) :
                idOrBlock;
            const displayText = isCurrentSprite || !spriteName ? txt : `[${spriteName}] ${txt}`;
            const clone = myBlocksByProcCode[displayText];
            if (clone) {
                if (!clone.clones) clone.clones = [];
                clone.clones.push(id);
                return clone;
            }

            const items = new BlockItem(cls, displayText, id, 0, opcode);
            if (typeof idOrBlock === 'object' && idOrBlock !== null &&
                typeof idOrBlock.getRelativeToSurfaceXY === 'function') {
                items.y = idOrBlock.getRelativeToSurfaceXY().y;
            } else {
                items.y = y;
            }
            items.spriteName = spriteName;
            items.isCurrentSprite = isCurrentSprite;
            myBlocks.push(items);
            myBlocksByProcCode[displayText] = items;
            return items;
        };

        const getDescFromField = root => {
            const fields = root.inputList[0];
            const parts = [];
            for (const fieldRow of fields.fieldRow) {
                // The green flag icon's src is pathToMedia + "green-flag.svg"
                // (e.g. "static/blocks-media/green-flag.svg"), so match on the
                // filename instead of a hard-coded full path.
                if (fieldRow.src_ && fieldRow.src_.endsWith('green-flag.svg')) {
                    parts.push(this.msgAny('/_general/blocks/green-flag'));
                } else {
                    const text = String(fieldRow.getText()).trim();
                    if (text) parts.push(text);
                }
            }
            return parts.join(' ');
        };

        const topBlocks = workspace.getTopBlocks();

        for (const root of topBlocks) {
            if (root.type === 'procedures_definition') {
                const label = root.getChildren()[0];
                const procCode = label.getProcCode();
                if (!procCode) continue;
                const indexOfLabel = root.inputList.findIndex(i => i.fieldRow.length > 0);
                if (indexOfLabel === -1) continue;
                const translatedDefine = root.inputList[indexOfLabel].fieldRow[0].getText();
                const message = indexOfLabel === 0 ?
                    `${translatedDefine} ${procCode}` :
                    `${procCode} ${translatedDefine}`;
                addBlock('define', message, root);
                continue;
            }

            if (root.type === 'event_whenflagclicked') {
                addBlock('flag', getDescFromField(root), root, root.type);
                continue;
            }

            if (root.type === 'event_whenbroadcastreceived') {
                const fieldRow = root.inputList[0].fieldRow;
                const eventName = fieldRow.find(input => input.name === 'BROADCAST_OPTION').getText();
                addBlock('receive', this.msg('event', {name: eventName}), root, root.type).eventName = eventName;
                continue;
            }

            if (root.type.substr(0, 10) === 'event_when') {
                addBlock('event', getDescFromField(root), root, root.type);
                continue;
            }

            if (root.type === 'control_start_as_clone') {
                addBlock('event', getDescFromField(root), root, root.type);
                continue;
            }
        }

        const allBlocks = this.workspace.getAllBlocks();
        const nonShadowBlocks = new Set();
        const textInputsByBlockId = new Map();

        const isTextInputField = field => {
            if (!field || typeof field.getText !== 'function') return false;
            if (this.ScratchBlocks.FieldTextInput && field instanceof this.ScratchBlocks.FieldTextInput) return true;
            if (this.ScratchBlocks.FieldNumber && field instanceof this.ScratchBlocks.FieldNumber) return true;
            const ctorName = field.constructor && field.constructor.name;
            return ctorName === 'FieldTextInput' || ctorName === 'FieldNumber' || ctorName === 'FieldAngle';
        };

        const collectTextInputsFromBlock = block => {
            const inputList = block.inputList;
            if (!inputList) return [];

            const values = [];
            for (const input of inputList) {
                const fieldRow = input.fieldRow;
                if (!fieldRow) continue;
                for (const field of fieldRow) {
                    //if (!isTextInputField(field)) continue;
                    const text = String(field.getText()).trim();
                    if (text) values.push(text);
                }
            }
            return values;
        };

        for (const block of allBlocks) {
            if (!block) continue;
            if (!block.isShadow_) {
                nonShadowBlocks.add(block);
            }

            if (block.id) {
                const values = collectTextInputsFromBlock(block);
                if (values.length > 0) {
                    let entry = textInputsByBlockId.get(block.id);
                    if (!entry) {
                        entry = {block, values: new Set()};
                        textInputsByBlockId.set(block.id, entry);
                    }
                    for (const value of values) entry.values.add(value);
                }
            }
        }

        for (const block of nonShadowBlocks) {
            const blockType = block.type;
            if (
                !blockType.startsWith('data_') &&
                !blockType.startsWith('event_') &&
                !blockType.startsWith('procedures_') &&
                blockType !== 'control_start_as_clone' &&
                blockType !== 'event_broadcast' &&
                blockType !== 'event_broadcastandwait'
            ) {
                addBlock(blockType, blockType, block, blockType);
            }
        }

        const map = this.workspace.getVariableMap();

        const vars = map.getVariablesOfType('');
        for (const row of vars) {
            addBlock(
                row.isLocal ? 'var' : 'VAR',
                row.isLocal ? this.msg('var-local', {name: row.name}) : this.msg('var-global', {name: row.name}),
                row
            );
        }

        const lists = map.getVariablesOfType('list');
        for (const row of lists) {
            addBlock(
                row.isLocal ? 'list' : 'LIST',
                row.isLocal ? this.msg('list-local', {name: row.name}) : this.msg('list-global', {name: row.name}),
                row
            );
        }

        const events = this.getCallsToEvents();
        for (const event of events) {
            addBlock('receive', this.msg('event', {name: event.eventName}), event.block).eventName = event.eventName;
        }

        for (const {block, values} of textInputsByBlockId.values()) {
            const inputsText = Array.from(values).join(', ');
            if (!inputsText) continue;

            const displayText = `${block.type}: ${inputsText}`;
            const item = addBlock(block.type, displayText, block, block.type);
            item.isTextInputEntry = true;
        }

        // The workspace only renders the scripts you are near, but searching has
        // to cover the whole sprite, so pick up whatever is not rendered from the
        // VM, which holds all of it either way.
        this.addUnrenderedBlocks(workspace, addBlock);

        const clsOrder = {flag: 0, receive: 1, event: 2, define: 3, var: 4, VAR: 5, list: 6, LIST: 7};
        const rank = cls => (cls in clsOrder ? clsOrder[cls] : 8);

        myBlocks.sort((a, b) => {
            const t = rank(a.cls) - rank(b.cls);
            if (t !== 0) return t;
            if (a.lower < b.lower) return -1;
            if (a.lower > b.lower) return 1;
            return (a.y || 0) - (b.y || 0);
        });

        return myBlocks;
    }

    /**
     * Index the blocks the workspace has not rendered, straight from the VM.
     * @param {object} workspace The Blockly workspace.
     * @param {Function} addBlock Adds an entry, as used by addBlocksFromWorkspace.
     */
    addUnrenderedBlocks (workspace, addBlock) {
        const target = this.utils.getEditingTarget();
        const vmBlocks = target && target.blocks && target.blocks._blocks;
        if (!vmBlocks) return;

        const scriptY = new Map();
        if (typeof workspace.getDeferredScripts === 'function') {
            for (const script of workspace.getDeferredScripts()) {
                scriptY.set(script.id, script.y);
            }
        }

        const textOf = value => (
            value === null || typeof value === 'undefined' ? '' : String(value).trim()
        );
        const fieldValuesOf = block => {
            const values = [];
            for (const name of Object.keys(block.fields || {})) {
                const text = textOf(block.fields[name].value);
                if (text) values.push(text);
            }
            for (const name of Object.keys(block.inputs || {})) {
                const shadow = vmBlocks[block.inputs[name].shadow];
                if (!shadow || !shadow.fields) continue;
                for (const fieldName of Object.keys(shadow.fields)) {
                    const text = textOf(shadow.fields[fieldName].value);
                    if (text) values.push(text);
                }
            }
            return values;
        };
        const hatLabel = block => {
            const template = this.ScratchBlocks.Msg[normalizeType(block.opcode)];
            if (typeof template === 'string') {
                const values = fieldValuesOf(block);
                let i = 0;
                return template.replace(/%\d+/g, () => {
                    const value = values[i++];
                    return typeof value === 'undefined' ? '()' : value;
                }).trim();
            }
            return block.opcode.replace('event_when', 'when ').replace(/_/g, ' ');
        };

        for (const blockId of Object.keys(vmBlocks)) {
            const block = vmBlocks[blockId];
            if (!block || block.shadow || !block.opcode) continue;
            // Blocks that are already rendered on the workspace were indexed by
            // getScratchBlocks() above. Only pick up blocks the workspace has
            // NOT rendered (e.g. deferred/virtualized scripts off-screen);
            // otherwise every visible hat gets listed twice.
            if (typeof workspace.getBlockById === 'function' && workspace.getBlockById(blockId)) {
                continue;
            }
            const opcode = block.opcode;
            const y = block.topLevel && typeof block.y === 'number' ? block.y : null;

            if (block.topLevel) {
                if (opcode === 'procedures_definition') {
                    const protoId = block.inputs && block.inputs.custom_block &&
                        block.inputs.custom_block.block;
                    const proto = protoId && vmBlocks[protoId];
                    const procCode = (proto && proto.mutation && proto.mutation.proccode) ||
                        'custom block';
                    addBlock('define', `define ${procCode}`, blockId, opcode, y);
                } else if (opcode === 'event_whenflagclicked') {
                    const flag = this.msgAny('/_general/blocks/green-flag');
                    const template = this.ScratchBlocks.Msg.EVENT_WHENFLAGCLICKED;
                    const text = typeof template === 'string' ?
                        template.replace('%1', flag) :
                        `when ${flag} clicked`;
                    addBlock('flag', text, blockId, opcode, y);
                } else if (opcode === 'event_whenbroadcastreceived') {
                    const eventName = (block.fields && block.fields.BROADCAST_OPTION &&
                        block.fields.BROADCAST_OPTION.value) || 'message';
                    addBlock('receive', this.msg('event', {name: eventName}), blockId, opcode, y)
                        .eventName = eventName;
                } else if (opcode.startsWith('event_when') || opcode === 'control_start_as_clone') {
                    addBlock('event', hatLabel(block), blockId, opcode, y);
                }
            }

            if (
                !opcode.startsWith('data_') &&
                !opcode.startsWith('event_') &&
                !opcode.startsWith('procedures_') &&
                opcode !== 'control_start_as_clone'
            ) {
                addBlock(opcode, opcode, blockId, opcode);
            }

            if (opcode === 'event_broadcast' || opcode === 'event_broadcastandwait') {
                const menuId = block.inputs && block.inputs.BROADCAST_INPUT &&
                    (block.inputs.BROADCAST_INPUT.block || block.inputs.BROADCAST_INPUT.shadow);
                const menu = menuId && vmBlocks[menuId];
                const eventName = menu && menu.fields && menu.fields.BROADCAST_OPTION ?
                    menu.fields.BROADCAST_OPTION.value :
                    this.msg('complex-broadcast');
                addBlock('receive', this.msg('event', {name: eventName}), blockId, opcode)
                    .eventName = eventName;
            }

            const values = fieldValuesOf(block);
            if (values.length) {
                addBlock(opcode, `${opcode}: ${values.join(', ')}`, blockId, opcode)
                    .isTextInputEntry = true;
            }
        }

        const addVars = (variables, isLocal) => {
            if (!variables) return;
            for (const varId of Object.keys(variables)) {
                const variable = variables[varId];
                if (variable.type === '') {
                    addBlock(
                        isLocal ? 'var' : 'VAR',
                        isLocal ?
                            this.msg('var-local', {name: variable.name}) :
                            this.msg('var-global', {name: variable.name}),
                        varId
                    );
                } else if (variable.type === 'list') {
                    addBlock(
                        isLocal ? 'list' : 'LIST',
                        isLocal ?
                            this.msg('list-local', {name: variable.name}) :
                            this.msg('list-global', {name: variable.name}),
                        varId
                    );
                }
            }
        };
        const stage = this.vm.runtime.getTargetForStage();
        if (stage) addVars(stage.variables, false);
        if (target !== stage) addVars(target.variables, true);
    }

    getScratchCostumes () {
        const costumes = this.utils.getEditingTarget().getCostumes();
        const items = [];
        let i = 0;
        for (const costume of costumes) {
            items.push(new BlockItem('costume', costume.name, costume.assetId, i));
            i++;
        }
        return items;
    }

    getScratchSounds () {
        const sounds = this.utils.getEditingTarget().getSounds();
        const items = [];
        let i = 0;
        for (const sound of sounds) {
            items.push(new BlockItem('sound', sound.name, sound.assetId, i));
            i++;
        }
        return items;
    }
    getCallsToEvents () {
        const uses = [];
        const alreadyFound = new Set();

        for (const block of this.workspace.getAllBlocks()) {
            if (block.type !== 'event_broadcast' && block.type !== 'event_broadcastandwait') {
                continue;
            }

            const broadcastInput = block.getChildren()[0];
            if (!broadcastInput) continue;

            let eventName = '';
            if (broadcastInput.type === 'event_broadcast_menu') {
                eventName = broadcastInput.inputList[0].fieldRow[0].getText();
            } else {
                eventName = this.msg('complex-broadcast');
            }

            if (!alreadyFound.has(eventName)) {
                alreadyFound.add(eventName);
                uses.push({eventName, block});
            }
        }

        return uses;
    }
}