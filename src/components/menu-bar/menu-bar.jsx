/* eslint-disable react/no-unused-prop-types */
/* eslint-disable no-unused-vars */
import classNames from 'classnames';
import {getItem as getStorageItem} from '../../lib/utils/safe-storage.js';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { defineMessages, FormattedMessage, injectIntl, intlShape } from 'react-intl';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import bowser from 'bowser';
import React from 'react';

import { updateCallbacks } from '../../lib/shortcuts/event-router.js';

import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import CommunityButton from './community-button.jsx';
import ShareButton from './share-button.jsx';
import openMistWarpShareWindow from '../../lib/mw/open-mw-share-window.js';
import {
    getRememberedPlatformProjectState,
    getMistWarpAction,
    rememberPlatformProject
} from '../../lib/community/publish.js';
import {getProject as getMistWarpProject} from '../../lib/community/api.js';
import communityEnabled from '../../lib/community/enabled.js';
import {ComingSoonTooltip} from '../coming-soon/coming-soon.jsx';
import Divider from '../divider/divider.jsx';
// import SaveStatus from './save-status.jsx';
import ProjectWatcher from '../../containers/project-watcher.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import MenuLabel from './tw-menu-label.jsx';
import { MenuItem, MenuSection, Submenu } from '../menu/menu.jsx';
import ProjectTitleInput from './project-title-input.jsx';
import AuthorInfo from './author-info.jsx';
import SB3Downloader from '../../containers/sb3-downloader.jsx';
import DeletionRestorer from '../../containers/deletion-restorer.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';
import FramerateChanger from '../../containers/tw-framerate-changer.jsx';
import MenuBarHOC from '../../containers/menu-bar-hoc.jsx';
import SettingsMenu from './settings-menu.jsx';
import TWViewCounter from './tw-view-counter.jsx';

import ChangeUsername from '../../containers/tw-change-username.jsx';
import CloudVariablesToggler from '../../containers/tw-cloud-toggler.jsx';
import TWSaveStatus from './tw-save-status.jsx';
import TWNews from './tw-news.jsx';
import CollaborationContainer from '../../containers/collaboration-container.jsx';

import TWDesktopSettings from './tw-desktop-settings.jsx';
import RoturAccount from './mw-rotur-account.jsx';
import MwEditorNav from './mw-editor-nav.jsx';
import CollabPresence from './mw-collab-presence.jsx';

import { FEEDBACK_URL, APP_NAME } from '../../lib/constants/brand.js';

import {
    openTipsLibrary,
    openSettingsModal,
    openRestorePointModal,
    openProjectMetadataModal,
    openGitModal,
    openExtensionManagerModal,
    openHelp,
    openSimpleDialog
} from '../../reducers/modals';
import {openCollaborationModal} from '../../reducers/collaboration';
import {setPlayer} from '../../reducers/mode';
import {
    isTimeTravel220022BC,
    isTimeTravel1920,
    isTimeTravel1990,
    isTimeTravel2020,
    isTimeTravelNow,
    setTimeTravel
} from '../../reducers/time-travel';
import {
    autoUpdateProject,
    getIsUpdating,
    getIsShowingProject,
    manualUpdateProject,
    requestNewProject,
    remixProject,
    saveProjectAsCopy
} from '../../reducers/project-state';
import {
    openAboutMenu,
    closeAboutMenu,
    aboutMenuOpen,
    openAccountMenu,
    closeAccountMenu,
    accountMenuOpen,
    openFileMenu,
    closeFileMenu,
    fileMenuOpen,
    openWorkspaceBookmarksMenu,
    closeWorkspaceBookmarksMenu,
    workspaceBookmarksMenuOpen,
    openEditMenu,
    closeEditMenu,
    editMenuOpen,
    openLoginMenu,
    closeLoginMenu,
    loginMenuOpen,
    openModeMenu,
    closeModeMenu,
    modeMenuOpen,
    errorsMenuOpen,
    openErrorsMenu,
    closeErrorsMenu,
    openToolsMenu,
    closeToolsMenu,
    toolsMenuOpen
} from '../../reducers/menus';
import {setFileHandle} from '../../reducers/tw.js';
import {setProjectUnchanged} from '../../reducers/project-changed';
import {showStandardAlert, showAlertWithTimeout, closeAlertWithId} from '../../reducers/alerts';
import collectMetadata from '../../lib/collect-metadata';
import LazyScratchBlocks from '../../lib/tw-lazy-scratch-blocks';
import buildHttpAuth from '../../lib/git/auth.js';
import translateGitError from '../../lib/git/errors.js';
import {hasChanges as gitHasChanges} from '../../lib/git/state/selectors.js';
import {mediaRecorderSupported} from '../../addons/environment.js';
import addonEnglish from '../../addons/addons-l10n/en.json';
import addonChinese from '../../addons/addons-l10n/zh-cn.json';
import initBlockCount from '../../lib/menu-bar/block-count-analysis.js';
import {
    getSetting as getMenuBarSetting,
    getSettings as getMenuBarSettings,
    onSettingsChanged
} from '../../lib/menu-bar/settings.js';

// The git toolchain (isomorphic-git, lightning-fs, jszip) and the terminal
// (xterm) are heavy and only needed when the user actually uses those features.
// They are imported lazily inside the handlers below so they don't slow down
// the first editor load.

import WorkspaceBookmarksMenu from './workspace-bookmarks-menu.jsx';
import MediaRecorderButton from './media-recorder.jsx';

import {
    createWorkspaceBookmarksExportData,
    downloadJsonObject,
    getDefaultWorkspaceBookmarksPayload,
    mergeWorkspaceBookmarksPayload,
    readWorkspaceBookmarksFromStage,
    writeWorkspaceBookmarksToStage
} from '../../lib/mw/workspace-bookmarks.js';

import styles from './menu-bar.css';
import '!!style-loader!css-loader!./block-count.css';

// import helpIcon from '../../lib/assets/icon--tutorials.svg';
// import mystuffIcon from './icon--mystuff.png';
// import profileIcon from './icon--profile.png';

import ChevronDown from './ChevronDown.jsx';

import PineWarpLogo from './pinewarp-logo.jsx';
import ninetiesLogo from './nineties_logo.svg';
import catLogo from './cat_logo.svg';
import prehistoricLogo from './prehistoric-logo.svg';
import oldtimeyLogo from './oldtimey-logo.svg';

import {
    FilePen, PencilRuler, TriangleAlert, Info, Shuffle, Zap, Gauge,
    FilePlusCorner, Upload, RefreshCcw, ClockPlus, Package,
    Save, ArchiveRestore, UserPen, Cloud, PackagePlus, Puzzle,
    Bookmark, GitBranch, FileCog, Bug, Database, Undo, Redo, Handshake, Wrench, Send,
    Download, AppWindow, Computer, Shield, Code, Code2, TerminalSquare, ChartColumn, ListTodo,
    Blocks as BlocksIcon, Menu as MenuIcon, Globe, ExternalLink, Pause, Play, HelpCircle
} from 'lucide-react';

import sharedMessages from '../../lib/constants/shared-messages';

import SeeInsideButton from './tw-see-inside.jsx';

/* const ariaMessages = defineMessages({
    tutorials: {
        id: 'gui.menuBar.tutorialsLibrary',
        defaultMessage: 'Tutorials',
        description: 'accessibility text for the tutorials button'
    }
}); */

const twMessages = defineMessages({
    compileError: {
        id: 'tw.menuBar.compileError',
        defaultMessage: '{sprite}: {error}',
        description: 'Error message in error menu'
    },
    pinewarpHome: {
        id: 'tw.menuBar.pinewarpHome',
        defaultMessage: 'PineWarp home',
        description: 'Title for the home link in the menu bar'
    },
    pinewarpLogoAlt: {
        id: 'tw.menuBar.pinewarpLogoAlt',
        defaultMessage: 'PineWarp',
        description: 'Alt text for the PineWarp logo'
    },
    moreMenu: {
        id: 'tw.menuBar.moreMenu',
        defaultMessage: 'More',
        description: 'Title for the More menu button'
    }
});

const MenuBarItemTooltip = ({
    children,
    className,
    enable,
    id,
    place = 'bottom'
}) => {
    if (enable) {
        return (
            <React.Fragment>
                {children}
            </React.Fragment>
        );
    }
    return (
        <ComingSoonTooltip
            className={classNames(styles.comingSoon, className)}
            place={place}
            tooltipClassName={styles.comingSoonTooltip}
            tooltipId={id}
        >
            {children}
        </ComingSoonTooltip>
    );
};


MenuBarItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    enable: PropTypes.bool,
    id: PropTypes.string,
    place: PropTypes.oneOf(['top', 'bottom', 'left', 'right'])
};

const MenuItemTooltip = ({ id, isRtl, children, className }) => (
    <ComingSoonTooltip
        className={classNames(styles.comingSoon, className)}
        isRtl={isRtl}
        place={isRtl ? 'left' : 'right'}
        tooltipClassName={styles.comingSoonTooltip}
        tooltipId={id}
    >
        {children}
    </ComingSoonTooltip>
);

MenuItemTooltip.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    id: PropTypes.string,
    isRtl: PropTypes.bool
};

const AboutButton = props => (
    <Button
        className={classNames(styles.menuBarItem, styles.hoverable)}
        iconClassName={styles.aboutIcon}
        iconElem={Info}
        onClick={props.onClick}
    />
);

AboutButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

// Unlike <MenuItem href="">, this uses an actual <a>
const MenuItemLink = props => (
    <a
        href={props.href}
        rel="noreferrer"
        target="_blank"
        className={styles.menuItemLink}
    >
        <MenuItem>{props.children}</MenuItem>
    </a>
);

MenuItemLink.propTypes = {
    children: PropTypes.node.isRequired,
    href: PropTypes.string.isRequired
};

const formatShortcutDisplay = keyCombo => {
    if (!keyCombo) return '';
    const platform = bowser.mac ? 'mac' : 'windows';
    return keyCombo
        .replace(/Ctrl/g, platform === 'mac' ? '⌘' : 'Ctrl')
        .replace(/Cmd/g, '⌘')
        .replace(/Alt/g, platform === 'mac' ? '⌥' : 'Alt')
        .replace(/Shift/g, '⇧')
        .replace(/Space/g, '␣')
        .replace(/Enter/g, '↵')
        .replace(/ /g, '');
};

const COLLAPSE_MENU_WIDTH = 900;
// 内置功能(如 block-count)的消息翻译维护在 addons-l10n 中，但 intl 的 messages
// 并不包含这些键，因此需要把当前 locale 的 addon 翻译作为 defaultMessage 传入，
// 否则即使 addons-l10n 中有翻译也只会显示英文或原始 key。
const ADDON_L10N = {
    en: addonEnglish,
    'zh-cn': addonChinese
};
const addonMessage = (intl, addonId) => (id, values) => {
    const key = `${addonId}/${id}`;
    const locale = intl && intl.locale ? intl.locale.toLowerCase() : 'en';
    const localeMessages = ADDON_L10N[locale];
    const defaultMessage = (localeMessages && localeMessages[key]) || addonEnglish[key] || id;
    return intl.formatMessage({
        id: key,
        defaultMessage
    }, values);
};

class MenuBar extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            autosaveTimeRemaining: 0,
            autosavePaused: false,
            workspaceBookmarks: [],
            workspaceBookmarksCategories: [],
            workspaceBookmarksCollapsedCategories: [],
            isEditingWorkspaceBookmark: false,
            canUndo: true,
            canRedo: true,
            gitRepoExists: false,
            gitHasChanges: false,
            gitRemotes: [],
            menuCollapsed: false,
            moreMenuOpen: false,
            menuBarSettings: getMenuBarSettings(),
            mistwarpProject: getRememberedPlatformProjectState()
        };
        this.menuBarRef = React.createRef();
        this.blockCountRef = React.createRef();
        this.workspaceBookmarksMenuLabelRef = React.createRef();
        this.blockCountController = null;
        this.disposeMenuBarSettings = null;
        this.menuResizeObserver = null;
        this.workspaceBookmarksProjectListener = null;
        this.autosaveCountdownInterval = null;
        this.undoRedoChangeListener = null;
        bindAll(this, [
            'handleDocumentMouseDown',
            'handleToggleMoreMenu',
            'handleClickSeeInside',
            'handleClickNew',
            'handleClickNewWindow',
            'handleClickRemix',
            'handleClickSave',
            'handleClickSaveAsCopy',
            'handleClickPackager',
            'handleClickRestorePoints',
            'handleClickProjectMetadata',
            'handleClickShare',
            'handleClickMistWarpShare',
            'handleClickSeeMistWarpPage',
            'refreshMistWarpShared',
            'handleClickUndo',
            'handleClickRedo',
            'handleClickCollaboration',
            'handleClickFile',
            'refreshGitMenuState',
            'handleClickGitCommit',
            'handleClickGitPush',
            'handleClickGitPull',
            'handleSetMode',
            'handleKeyPress',
            'handleRestoreOption',
            'getSaveToComputerHandler',
            'restoreOptionMessage',
            'handleToggleAutosave',
            'getAutosaveEnabled',
            'getAutosaveTimeRemaining',
            'loadWorkspaceBookmarksFromProject',
            'saveWorkspaceBookmarksToProject',
            'ensureScratchBlocks',
            'getCurrentWorkspaceBookmarkState',
            'applyWorkspaceBookmarkState',
            'updateUndoRedoState',
            'handleAddWorkspaceBookmark',
            'handleSwitchWorkspaceBookmark',
            'handleDeleteWorkspaceBookmark',
            'handleEditWorkspaceBookmark',
            'handleToggleWorkspaceBookmarkCategoryCollapsed',
            'handleExportWorkspaceBookmarks',
            'handleImportWorkspaceBookmarks',
            'handleClearAllWorkspaceBookmarks',
            'showAlert',
            'showPrompt',
            'showConfirm',
            'getShortcut'
        ]);
    }
    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyPress);
        document.addEventListener('mousedown', this.handleDocumentMouseDown);
        this.observeMenuBarWidth();
        this.startAutosaveCountdown();
        this.refreshMistWarpShared();
        if (this.blockCountRef.current) {
            this.blockCountController = initBlockCount({
                vm: this.props.vm,
                display: this.blockCountRef.current,
                getSetting: getMenuBarSetting,
                getBlockly: this.ensureScratchBlocks,
                msg: addonMessage(this.props.intl, 'block-count')
            });
        }
        this.disposeMenuBarSettings = onSettingsChanged(() => {
            const previousSettings = this.state.menuBarSettings;
            const menuBarSettings = getMenuBarSettings();
            this.setState({menuBarSettings}, () => {
                if (this.blockCountController) this.blockCountController.update();
                if (menuBarSettings.autosave_enabled !== previousSettings.autosave_enabled ||
                    menuBarSettings.autosave_interval !== previousSettings.autosave_interval) {
                    this.startAutosaveCountdown();
                }
            });
        });

        // Prevent the legacy addon from also injecting a bookmarks menu.
        window.__pinewarpNativeWorkspaceBookmarks = true;

        // Expose showPrompt for addons
        window.__pinewarpPrompt = this.showPrompt.bind(this);

        this.loadWorkspaceBookmarksFromProject();
        if (this.props.vm && this.props.vm.runtime) {
            this.workspaceBookmarksProjectListener = () => {
                this.loadWorkspaceBookmarksFromProject();
                this.refreshMistWarpShared();
            };
            this.props.vm.runtime.on('PROJECT_LOADED', this.workspaceBookmarksProjectListener);
        }

        this.ensureScratchBlocks().then(ScratchBlocks => {
            const workspace = ScratchBlocks.getMainWorkspace();
            if (workspace) {
                this.undoRedoChangeListener = () => {
                    setTimeout(() => this.updateUndoRedoState(), 0);
                };
                workspace.addChangeListener(this.undoRedoChangeListener);
                setTimeout(() => this.updateUndoRedoState(), 100);
            }
        });
    }
    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyPress);
        document.removeEventListener('mousedown', this.handleDocumentMouseDown);
        if (this.blockCountController) this.blockCountController.destroy();
        if (this.disposeMenuBarSettings) this.disposeMenuBarSettings();
        if (this.menuResizeObserver) {
            this.menuResizeObserver.disconnect();
            this.menuResizeObserver = null;
        }

        if (this.autosaveCountdownInterval) {
            clearInterval(this.autosaveCountdownInterval);
            this.autosaveCountdownInterval = null;
        }

        if (this.props.vm && this.props.vm.runtime && this.workspaceBookmarksProjectListener) {
            this.props.vm.runtime.off('PROJECT_LOADED', this.workspaceBookmarksProjectListener);
        }

        if (this.undoRedoChangeListener) {
            this.ensureScratchBlocks().then(ScratchBlocks => {
                const workspace = ScratchBlocks.getMainWorkspace();
                if (workspace) {
                    workspace.removeChangeListener(this.undoRedoChangeListener);
                }
            });
        }
    }

    getShortcut(keyId) {
        const keyIdMap = {
            'new': 'new',
            'open': 'loadFromComputer',
            'save': 'save',
            'saveAs': 'saveAsCopy',
            'print': 'packageProject',
            'remix': 'restorePoints',
            'undo': 'undo',
            'redo': 'redo',
            'settings': 'settings',
            'backpack': 'toggleBackpack',
            'extensionManager': 'extensionManager'
        };
        const registryKeyId = keyIdMap[keyId] || keyId;
        if (this.props.customShortcuts && this.props.customShortcuts[registryKeyId]) {
            return this.props.customShortcuts[registryKeyId];
        }
        const defaultShortcuts = {
            'new': 'Ctrl+N',
            'loadFromComputer': 'Ctrl+O',
            'save': 'Ctrl+S',
            'saveAsCopy': 'Ctrl+Shift+S',
            'packageProject': 'Ctrl+P',
            'restorePoints': 'Alt+R',
            'undo': 'Ctrl+Z',
            'redo': 'Ctrl+Y',
            'settings': 'Ctrl+,',
            'toggleBackpack': 'Ctrl+.',
            'extensionManager': 'Alt+E'
        };
        return defaultShortcuts[registryKeyId] || '';
    }

    observeMenuBarWidth () {
        const el = this.menuBarRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        this.menuResizeObserver = new ResizeObserver(() => {
            const collapsed = el.getBoundingClientRect().width < COLLAPSE_MENU_WIDTH;
            if (collapsed !== this.state.menuCollapsed) {
                this.setState({menuCollapsed: collapsed, moreMenuOpen: false});
            }
        });
        this.menuResizeObserver.observe(el);
    }

    handleDocumentMouseDown (e) {
        if (!this.state.moreMenuOpen) return;
        const el = this.menuBarRef.current;
        if (el && el.contains(e.target)) return;
        this.setState({moreMenuOpen: false});
    }

    handleToggleMoreMenu () {
        this.setState(prevState => ({moreMenuOpen: !prevState.moreMenuOpen}));
    }

    showAlert (title, message) {
        return new Promise(resolve => {
            this.props.openSimpleDialog({
                type: 'alert',
                title,
                message,
                onOk: () => resolve()
            });
        });
    }

    showPrompt(title, message, defaultValue = '') {
        return new Promise(resolve => {
            this.props.openSimpleDialog({
                type: 'prompt',
                title,
                message,
                defaultValue,
                onOk: value => resolve(value),
                onCancel: () => resolve(null)
            });
        });
    }

    showConfirm(title, message) {
        return new Promise(resolve => {
            this.props.openSimpleDialog({
                type: 'confirm',
                title,
                message,
                onOk: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    handleClickNew() {
        // if the project is dirty, and user owns the project, we will autosave.
        // but if they are not logged in and can't save, user should consider
        // downloading or logging in first.
        // Note that if user is logged in and editing someone else's project,
        // they'll lose their work.
        const readyToReplaceProject = this.props.confirmReadyToReplaceProject(
            this.props.intl.formatMessage(sharedMessages.replaceProjectWarning)
        );
        this.props.onRequestCloseFile();
        if (readyToReplaceProject) {
            this.props.onClickNew(this.props.canSave && this.props.canCreateNew);
        }
        this.props.onRequestCloseFile();
    }
    handleClickNewWindow() {
        this.props.onClickNewWindow();
        this.props.onRequestCloseFile();
    }
    handleClickRemix() {
        this.props.onClickRemix();
        this.props.onRequestCloseFile();
    }
    handleClickSave() {
        if (this.props.handleSaveProject) {
            this.props.handleSaveProject();
        }
        this.props.onRequestCloseFile();
    }
    handleClickSaveAsCopy() {
        this.props.onClickSaveAsCopy();
        this.props.onRequestCloseFile();
    }
    handleClickPackager() {
        this.props.onClickPackager();
        this.props.onRequestCloseFile();
    }
    handleClickDesktopSettings() {
        this.props.onClickDesktopSettings();
        this.props.onRequestCloseSettings();
    }
    handleClickRestorePoints () {
        this.props.onClickRestorePoints();
        this.props.onRequestCloseFile();
    }
    handleClickProjectMetadata () {
        this.props.onClickProjectMetadata();
        this.props.onRequestCloseTools();
    }
    handleClickAddRestorePoint = () => {
        if (this.props.vm) {
            this.props.vm.emit('TRIGGER_MANUAL_RESTORE_POINT');
        }
    };
    handleClickSeeCommunity(waitForUpdate) {
        if (this.props.shouldSaveBeforeTransition()) {
            this.props.autoUpdateProject(); // save before transitioning to project page
            waitForUpdate(true); // queue the transition to project page
        } else {
            waitForUpdate(false); // immediately transition to project page
        }
    }
    handleClickShare(waitForUpdate) {
        if (!this.props.isShared) {
            if (this.props.canShare) { // save before transitioning to project page
                this.props.onShare();
            }
            if (this.props.canSave) { // save before transitioning to project page
                this.props.autoUpdateProject();
                waitForUpdate(true); // queue the transition to project page
            } else {
                waitForUpdate(false); // immediately transition to project page
            }
        }
    }
    handleClickCollaboration() {
        this.props.onClickCollaboration();
    }
    refreshMistWarpShared () {
        const remembered = communityEnabled ? getRememberedPlatformProjectState() : null;
        if (!remembered) {
            this.setState({mistwarpProject: null});
            return;
        }
        this.setState({mistwarpProject: remembered});
        getMistWarpProject(remembered.id)
            .then(data => {
                const current = getRememberedPlatformProjectState();
                if (!current || String(current.id) !== String(remembered.id)) return;
                rememberPlatformProject(data.project);
                this.setState({mistwarpProject: data.project});
            })
            .catch(e => {
                if (e && e.status === 404) {
                    const current = getRememberedPlatformProjectState();
                    if (!current || String(current.id) !== String(remembered.id)) return;
                    rememberPlatformProject(null);
                    this.setState({mistwarpProject: null});
                }
            });
    }
    handleClickMistWarpShare () {
        this.props.onRequestCloseFile();
        openMistWarpShareWindow({
            vm: this.props.vm,
            initialTitle: this.props.projectTitle,
            action: getMistWarpAction(this.state.mistwarpProject, this.props.projectChanged),
            onPublished: result => {
                this.setState({mistwarpProject: {id: result.id, isOwner: true, shared: !!result.shared}});
                this.props.onProjectUnchanged();
            }
        });
    }
    handleClickSeeMistWarpPage () {
        this.props.onRequestCloseFile();
        if (this.state.mistwarpProject) {
            window.location.href = `/project/${this.state.mistwarpProject.id}`;
        }
    }

    handleClickFile () {
        this.props.onClickFile();
        this.refreshMistWarpShared();
        this.refreshGitMenuState();
    }

    async refreshGitMenuState () {
        // Cheap on purpose: `getRepoChanges` is hash-cached, so a project that
        // did not change since the last serialization is not rebuilt. The VM is
        // still passed in, because the working tree is only kept current while
        // the git window is mounted — edits made with the window closed would
        // otherwise be invisible here.
        try {
            const {default: gitOps} = await import('../../lib/git/ops/index.js');
            await gitOps.refreshRepository({vm: this.props.vm});
            const state = gitOps.getState();
            const {repo, remotes} = state;
            this.setState({
                gitRepoExists: Boolean(repo.initialized),
                // The File menu has no staging area (it commits everything), so
                // its Commit item is gated on "the repository has anything to
                // commit" — the *git* signal the window uses — instead of the
                // GUI's `projectChanged` flag. The old check offered Commit while
                // git was clean and the window had its button greyed out (A2).
                gitHasChanges: gitHasChanges(state),
                gitRemotes: Array.isArray(remotes) ? remotes : []
            });
        } catch (e) {
            this.setState({gitRepoExists: false, gitHasChanges: false, gitRemotes: []});
        }
    }

    async gitAuth () {
        let token = '';
        try {
            token = getStorageItem('mw:git-token') || '';
        } catch (e) {
            token = '';
        }
        const {getDefaultAuthor} = await import('../../lib/git/browser-git');
        // Shared auth rule (lib/git/auth.js): anonymous when no token is stored,
        // otherwise author name as username or 'x-access-token' (GitHub PAT style).
        return buildHttpAuth({token, username: getDefaultAuthor().name});
    }

    // Every File → Git action goes through the shared ops layer, so it takes the
    // same single-flight lock as the git window (the two used to be able to
    // write the same OPFS repository at the same time) and reports into the
    // same store.
    //
    // A3: a failure surfaces as the app-wide bottom-right toast marked ❌️ —
    // exactly what the git window does — instead of a blocking browser alert.
    // The two surfaces used to disagree about how to report the same error.
    showGitError (e) {
        const message = translateGitError(e && e.message ? e.message : String(e));
        if (this.props.showToast) {
            this.props.showToast(message, 'error', 'bottom-right');
        } else {
            // eslint-disable-next-line no-alert
            window.alert(message);
        }
    }
    async handleClickGitPush (remote) {
        this.props.onRequestCloseFile();
        this.props.onShowGitStatus('gitPushing');
        try {
            const {default: gitOps} = await import('../../lib/git/ops/index.js');
            await gitOps.pushBranch({
                vm: this.props.vm,
                remote,
                setUpstream: true,
                onAuth: await this.gitAuth()
            });
            this.props.onGitStatusDone('gitPushSuccess');
        } catch (e) {
            console.error(e);
            this.props.onCloseGitStatus('gitPushing');
            this.showGitError(e);
        }
    }

    async handleClickGitPull (remote) {
        this.props.onRequestCloseFile();
        if (this.props.projectChanged) {
            // eslint-disable-next-line no-alert
            const ok = window.confirm(this.props.intl.formatMessage({
                defaultMessage: 'Pulling will replace your project with the repository version. Continue?',
                description: 'Confirmation before git pull replaces the open project',
                id: 'mw.menuBar.gitPull.confirmReplace'
            }));
            if (!ok) {
                return;
            }
        }
        this.props.onShowGitStatus('gitPulling');
        try {
            const {default: gitOps} = await import('../../lib/git/ops/index.js');
            const {getDefaultAuthor} = await import('../../lib/git/browser-git');
            // pullBranch raises its own safety restore point, and rebuilds +
            // reloads the open project ONLY when the working tree actually
            // moved. When the remote had nothing new it resolves with kind
            // 'ahead'/'up-to-date' — the old code called quit() + loadProject()
            // anyway, rebuilding the project for no reason and throwing away
            // the undo stack (the "drift" bug). Nothing to do here but report
            // success.
            await gitOps.pullBranch({
                vm: this.props.vm,
                remote,
                author: getDefaultAuthor(),
                onAuth: await this.gitAuth(),
                restorePointLabel: this.props.projectTitle
            });
            this.props.onGitStatusDone('gitPullSuccess');
        } catch (e) {
            console.error(e);
            this.props.onCloseGitStatus('gitPulling');
            this.showGitError(e);
        }
    }

    handleClickGitCommit () {
        this.props.onRequestCloseFile();
        // Defer so the menu closes before the (blocking) prompt appears.
        setTimeout(async () => {
            // eslint-disable-next-line no-alert
            const message = window.prompt(
                this.props.intl.formatMessage({
                    defaultMessage: 'Commit message',
                    description: 'Prompt title when committing to git from the File menu',
                    id: 'mw.menuBar.gitCommit.prompt'
                }),
                ''
            );
            if (message === null || !message.trim()) {
                return;
            }
            this.props.onShowGitStatus('gitCommitting');
            try {
                const {default: gitOps} = await import('../../lib/git/ops/index.js');
                const {getDefaultAuthor} = await import('../../lib/git/browser-git');
                await gitOps.commit({
                    vm: this.props.vm,
                    message: message.trim(),
                    author: getDefaultAuthor(),
                    // The File menu has no staging area, so it keeps the historic
                    // "commit everything" behaviour (decision D2 lives in the
                    // git window, which stages explicitly).
                    all: true
                });
                this.props.onGitStatusDone('gitCommitSuccess');
            } catch (e) {
                console.error(e);
                this.props.onCloseGitStatus('gitCommitting');
                this.showGitError(e);
            }
        }, 0);
    }
    handleSetMode (mode) {
        return () => {
            // Turn on/off filters for modes.
            if (mode === '1920') {
                document.documentElement.style.filter = 'brightness(.9)contrast(.8)sepia(1.0)';
                document.documentElement.style.height = '100%';
            } else if (mode === '1990') {
                document.documentElement.style.filter = 'hue-rotate(40deg)';
                document.documentElement.style.height = '100%';
            } else {
                document.documentElement.style.filter = '';
                document.documentElement.style.height = '';
            }

            // Change logo for modes
            if (mode === '1990') {
                document.getElementById('logo_img').src = ninetiesLogo;
            } else if (mode === '2020') {
                document.getElementById('logo_img').src = catLogo;
            } else if (mode === '1920') {
                document.getElementById('logo_img').src = oldtimeyLogo;
            } else if (mode === '220022BC') {
                document.getElementById('logo_img').src = prehistoricLogo;
            } else {
                document.getElementById('logo_img').src = this.props.logo;
            }

            this.props.onSetTimeTravelMode(mode);
        };
    }
    handleRestoreOption(restoreFun) {
        return () => {
            restoreFun();
            this.props.onRequestCloseEdit();
        };
    }
    handleKeyPress(event) {
        // Workspace bookmarks shortcuts (Ctrl+Alt+1..0 to switch, Ctrl+Alt+T to add)
        // Ignore when typing.
        const target = event.target;
        const isTyping = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );
        if (!isTyping && !this.props.isPlayerOnly && event.ctrlKey && event.altKey) {
            const key = event.key.toLowerCase();
            if (key >= '1' && key <= '9') {
                event.preventDefault();
                void this.handleSwitchWorkspaceBookmark(parseInt(key, 10) - 1);
                return;
            }
            if (key === '0') {
                event.preventDefault();
                void this.handleSwitchWorkspaceBookmark(9);
                return;
            }
            if (key === 't') {
                event.preventDefault();
                void this.handleAddWorkspaceBookmark();
                return;
            }
        }

        const modifier = bowser.mac ? event.metaKey : event.ctrlKey;
        if (modifier) {
            // Check if Ctrl+S or Ctrl+O have been customized
            const hasCustomShortcuts = this.props.customShortcuts && Object.keys(this.props.customShortcuts).length > 0;
            const isSaveCustomized = hasCustomShortcuts && this.props.customShortcuts.save;
            const isOpenCustomized = hasCustomShortcuts && this.props.customShortcuts.open;

            if (event.key.toLowerCase() === 's' && !isSaveCustomized) {
                this.props.handleSaveProject();
                event.preventDefault();
            } else if (event.key.toLowerCase() === 'o' && !isOpenCustomized) {
                event.preventDefault();
                this.props.onStartSelectingFileUpload();
            }
        }
    }

    loadWorkspaceBookmarksFromProject() {
        try {
            const vm = this.props.vm;
            if (!vm || !vm.runtime) return;
            const stage = vm.runtime.getTargetForStage();
            if (!stage || !stage.comments) return;

            const payload = readWorkspaceBookmarksFromStage(stage) || getDefaultWorkspaceBookmarksPayload();
            this.setState({
                workspaceBookmarks: payload.bookmarks,
                workspaceBookmarksCategories: payload.categories,
                workspaceBookmarksCollapsedCategories: payload.collapsedCategories
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to load workspace bookmarks:', e);
        }
    }

    saveWorkspaceBookmarksToProject() {
        try {
            const vm = this.props.vm;
            if (!vm || !vm.runtime) return;
            const stage = vm.runtime.getTargetForStage();
            if (!stage || !stage.comments) return;

            writeWorkspaceBookmarksToStage(stage, {
                bookmarks: this.state.workspaceBookmarks,
                categories: this.state.workspaceBookmarksCategories,
                collapsedCategories: this.state.workspaceBookmarksCollapsedCategories
            });

            if (vm.runtime.emitProjectChanged) {
                vm.runtime.emitProjectChanged();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to save workspace bookmarks:', e);
        }
    }

    ensureScratchBlocks() {
        if (LazyScratchBlocks.isLoaded()) {
            return Promise.resolve(LazyScratchBlocks.get());
        }
        return LazyScratchBlocks.load().then(() => LazyScratchBlocks.get());
    }

    async getCurrentWorkspaceBookmarkState() {
        const ScratchBlocks = await this.ensureScratchBlocks();
        const workspace = ScratchBlocks.getMainWorkspace();
        if (!workspace) return null;

        const metrics = workspace.getMetrics();
        const currentTarget = this.props.vm ? this.props.vm.editingTarget : null;

        return {
            scrollX: metrics.viewLeft,
            scrollY: metrics.viewTop,
            scale: workspace.scale,
            targetId: currentTarget ? currentTarget.id : null
        };
    }

    async applyWorkspaceBookmarkState(state) {
        if (!state) return;

        const vm = this.props.vm;
        if (!vm || !vm.runtime) return;

        if (state.targetId && state.targetId !== vm.editingTarget?.id) {
            const target = vm.runtime.getTargetById(state.targetId);
            if (target) {
                vm.setEditingTarget(state.targetId);
            }
        }

        const ScratchBlocks = await this.ensureScratchBlocks();
        const workspace = ScratchBlocks.getMainWorkspace();
        if (workspace && workspace.scrollbar) {
            workspace.setScale(state.scale);
            const scrollX = state.scrollX - workspace.getMetrics().contentLeft;
            const scrollY = state.scrollY - workspace.getMetrics().contentTop;
            workspace.scrollbar.set(scrollX, scrollY);
        }
    }

    async handleAddWorkspaceBookmark() {
        const maxTabs = 20;
        const enableCategories = true;

        this.isEditingWorkspaceBookmark = true;
        this.setState({isEditingWorkspaceBookmark: true});
        if (this.workspaceBookmarksMenuLabelRef.current) {
            this.workspaceBookmarksMenuLabelRef.current.setDisableClose(true);
        }

        try {
            if (this.state.workspaceBookmarks.length >= maxTabs) {
                await this.showAlert(
                    this.props.intl.formatMessage({
                        defaultMessage: 'Error',
                        id: 'tw.workspaceBookmarks.errorTitle'
                    }),
                    this.props.intl.formatMessage({
                        defaultMessage: 'Maximum number of bookmarks reached ({max})',
                        description: 'Alert when too many bookmarks exist',
                        id: 'tw.workspaceBookmarks.maxReached'
                    }, { max: maxTabs })
                );
                return;
            }

            const state = await this.getCurrentWorkspaceBookmarkState();
            if (!state) return;

            const name = await this.showPrompt(
                this.props.intl.formatMessage({
                    defaultMessage: 'Bookmark Name',
                    id: 'tw.workspaceBookmarks.nameTitle'
                }),
                this.props.intl.formatMessage({
                    defaultMessage: 'Bookmark name:',
                    description: 'Prompt title for bookmark name',
                    id: 'tw.workspaceBookmarks.namePrompt'
                }),
                this.props.intl.formatMessage({
                    defaultMessage: 'Bookmark {index}',
                    description: 'Prompt default value for bookmark name',
                    id: 'tw.menuBar.bookmarkDefaultName'
                }, { index: this.state.workspaceBookmarks.length + 1 })
            );
            if (name === null) return;

            let category = this.props.intl.formatMessage({
                defaultMessage: 'General',
                id: 'tw.menuBar.bookmarkDefaultCategory'
            });
            if (enableCategories) {
                const categoryInput = await this.showPrompt(
                    this.props.intl.formatMessage({
                        defaultMessage: 'Bookmark Category',
                        id: 'tw.workspaceBookmarks.categoryTitle'
                    }),
                    this.props.intl.formatMessage({
                        defaultMessage: 'Category (existing: {categories})',
                        description: 'Prompt for bookmark category',
                        id: 'tw.workspaceBookmarks.categoryPrompt'
                    }),
                    this.props.intl.formatMessage({
                        defaultMessage: 'General',
                        id: 'tw.menuBar.bookmarkDefaultCategory'
                    })
                );
                if (categoryInput === null) return;
                category = categoryInput.trim() || this.props.intl.formatMessage({
                    defaultMessage: 'General',
                    id: 'tw.menuBar.bookmarkDefaultCategory'
                });
            }

            const bookmark = {
                name: (name.trim() || `Bookmark ${this.state.workspaceBookmarks.length + 1}`),
                category,
                state,
                timestamp: Date.now()
            };

            this.setState(prev => {
                const categories = new Set(prev.workspaceBookmarksCategories);
                categories.add(category);
                return {
                    workspaceBookmarks: [...prev.workspaceBookmarks, bookmark],
                    workspaceBookmarksCategories: [...categories]
                };
            }, () => {
                this.saveWorkspaceBookmarksToProject();
            });
        } finally {
            this.isEditingWorkspaceBookmark = false;
            this.setState({isEditingWorkspaceBookmark: false});
            if (this.workspaceBookmarksMenuLabelRef.current) {
                this.workspaceBookmarksMenuLabelRef.current.setDisableClose(false);
            }
            this.props.onRequestCloseWorkspaceBookmarks();
        }
    }

    async handleSwitchWorkspaceBookmark(index) {
        if (index < 0 || index >= this.state.workspaceBookmarks.length) return;
        await this.applyWorkspaceBookmarkState(this.state.workspaceBookmarks[index].state);
        this.props.onRequestCloseWorkspaceBookmarks();
    }

    handleDeleteWorkspaceBookmark(index) {
        if (index < 0 || index >= this.state.workspaceBookmarks.length) return;
        this.setState(prev => {
            const next = [...prev.workspaceBookmarks];
            next.splice(index, 1);
            return { workspaceBookmarks: next };
        }, () => {
            this.saveWorkspaceBookmarksToProject();
        });
    }

    async handleEditWorkspaceBookmark(index) {
        const enableCategories = true;
        if (index < 0 || index >= this.state.workspaceBookmarks.length) return;

        this.isEditingWorkspaceBookmark = true;
        this.setState({isEditingWorkspaceBookmark: true});
        if (this.workspaceBookmarksMenuLabelRef.current) {
            this.workspaceBookmarksMenuLabelRef.current.setDisableClose(true);
        }

        try {
            const bookmark = this.state.workspaceBookmarks[index];

            const newName = await this.showPrompt(
                this.props.intl.formatMessage({
                    defaultMessage: 'Bookmark Name',
                    id: 'tw.workspaceBookmarks.nameTitle'
                }),
                this.props.intl.formatMessage({
                    defaultMessage: 'Bookmark name:',
                    description: 'Prompt title for bookmark name',
                    id: 'tw.workspaceBookmarks.namePrompt'
                }),
                bookmark.name
            );
            if (newName === null || newName.trim() === '') {
                return;
            }

            let newCategory = bookmark.category || this.props.intl.formatMessage({
                defaultMessage: 'General',
                id: 'tw.menuBar.bookmarkDefaultCategory'
            });
            if (enableCategories) {
                const categoryList = this.state.workspaceBookmarksCategories.join(', ');
                const categoryInput = await this.showPrompt(
                    this.props.intl.formatMessage({
                        defaultMessage: 'Bookmark Category',
                        id: 'tw.workspaceBookmarks.categoryTitle'
                    }),
                    this.props.intl.formatMessage({
                        defaultMessage: 'Category (existing: {categories})',
                        description: 'Prompt for bookmark category',
                        id: 'tw.workspaceBookmarks.categoryPrompt'
                    }, { categories: categoryList }),
                    newCategory
                );
                if (categoryInput !== null) {
                    newCategory = categoryInput.trim() || this.props.intl.formatMessage({
                        defaultMessage: 'General',
                        id: 'tw.menuBar.bookmarkDefaultCategory'
                    });;
                }
            }

            this.setState(prev => {
                const next = [...prev.workspaceBookmarks];
                next[index] = {
                    ...next[index],
                    name: newName.trim(),
                    category: newCategory
                };
                const categories = new Set(prev.workspaceBookmarksCategories);
                categories.add(newCategory);
                return {
                    workspaceBookmarks: next,
                    workspaceBookmarksCategories: [...categories]
                };
            }, () => {
                this.saveWorkspaceBookmarksToProject();
            });
        } finally {
            this.isEditingWorkspaceBookmark = false;
            this.setState({isEditingWorkspaceBookmark: false});
            if (this.workspaceBookmarksMenuLabelRef.current) {
                this.workspaceBookmarksMenuLabelRef.current.setDisableClose(false);
            }
            this.props.onRequestCloseWorkspaceBookmarks();
        }
    }

    handleToggleWorkspaceBookmarkCategoryCollapsed(category) {
        this.setState(prev => {
            const set = new Set(prev.workspaceBookmarksCollapsedCategories);
            if (set.has(category)) {
                set.delete(category);
            } else {
                set.add(category);
            }
            return { workspaceBookmarksCollapsedCategories: [...set] };
        }, () => {
            this.saveWorkspaceBookmarksToProject();
        });
    }

    handleExportWorkspaceBookmarks() {
        const data = createWorkspaceBookmarksExportData({
            bookmarks: this.state.workspaceBookmarks,
            categories: this.state.workspaceBookmarksCategories,
            collapsedCategories: this.state.workspaceBookmarksCollapsedCategories
        });
        downloadJsonObject(data, `workspace-bookmarks-${Date.now()}.json`);
        this.props.onRequestCloseWorkspaceBookmarks();
    }

    handleImportWorkspaceBookmarks() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', e => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data || !Array.isArray(data.bookmarks)) {
                        throw new Error('Invalid format');
                    }
                    const importCount = data.bookmarks.length;
                    this.setState(prev => {
                        const merged = mergeWorkspaceBookmarksPayload({
                            bookmarks: prev.workspaceBookmarks,
                            categories: prev.workspaceBookmarksCategories,
                            collapsedCategories: prev.workspaceBookmarksCollapsedCategories
                        }, data);
                        return {
                            workspaceBookmarks: merged.bookmarks,
                            workspaceBookmarksCategories: merged.categories
                        };
                    }, async () => {
                        this.saveWorkspaceBookmarksToProject();
                        await this.showAlert(
                            this.props.intl.formatMessage({
                                defaultMessage: 'Success',
                                id: 'tw.workspaceBookmarks.importTitle'
                            }),
                            this.props.intl.formatMessage({
                                defaultMessage: 'Successfully imported {count} bookmarks!',
                                description: 'Alert after importing bookmarks',
                                id: 'tw.workspaceBookmarks.importSuccess'
                            }, { count: importCount })
                        );
                    });
                } catch {
                    this.showAlert(
                        this.props.intl.formatMessage({
                            defaultMessage: 'Error',
                            id: 'tw.workspaceBookmarks.importErrorTitle'
                        }),
                        this.props.intl.formatMessage({
                            defaultMessage: 'Failed to import bookmarks. Please check the file format.',
                            description: 'Alert when import fails',
                            id: 'tw.workspaceBookmarks.importFailed'
                        })
                    );
                }
            };
            reader.readAsText(file);
        });
        input.click();
        this.props.onRequestCloseWorkspaceBookmarks();
    }

    async handleClearAllWorkspaceBookmarks() {
        if (this.state.workspaceBookmarks.length === 0) {
            this.props.onRequestCloseWorkspaceBookmarks();
            return;
        }
        const ok = await this.showConfirm(
            this.props.intl.formatMessage({
                defaultMessage: 'Confirm',
                id: 'tw.workspaceBookmarks.clearTitle'
            }),
            this.props.intl.formatMessage({
                defaultMessage: 'Are you sure you want to delete all {count} bookmarks? This action cannot be undone.',
                description: 'Confirmation when clearing bookmarks',
                id: 'tw.workspaceBookmarks.clearAllConfirm'
            }, { count: this.state.workspaceBookmarks.length })
        );
        if (!ok) {
            this.props.onRequestCloseWorkspaceBookmarks();
            return;
        }
        this.setState({
            workspaceBookmarks: [],
            workspaceBookmarksCategories: [this.props.intl.formatMessage({
                defaultMessage: 'General',
                id: 'tw.menuBar.bookmarkDefaultCategory'
            })],
            workspaceBookmarksCollapsedCategories: []
        }, () => {
            this.saveWorkspaceBookmarksToProject();
            this.props.onRequestCloseWorkspaceBookmarks();
        });
    }
    getSaveToComputerHandler(downloadProjectCallback) {
        return () => {
            this.props.onRequestCloseFile();
            downloadProjectCallback();
            if (this.props.onProjectTelemetryEvent) {
                const metadata = collectMetadata(this.props.vm, this.props.projectTitle, this.props.locale);
                this.props.onProjectTelemetryEvent('projectDidSave', metadata);
            }
        };
    }
    handleToggleAutosave () {
        this.setState(prevState => ({autosavePaused: !prevState.autosavePaused}));
    }
    getAutosaveEnabled () {
        return this.state.menuBarSettings.autosave_enabled;
    }
    getAutosaveTimeRemaining() {
        return this.state.autosaveTimeRemaining;
    }
    startAutosaveCountdown() {
        // Clear existing interval
        if (this.autosaveCountdownInterval) {
            clearInterval(this.autosaveCountdownInterval);
        }

        // Don't start countdown if autosave is disabled
        if (!this.getAutosaveEnabled()) {
            this.setState({ autosaveTimeRemaining: 0 });
            return;
        }

        const intervalMinutes = this.state.menuBarSettings.autosave_interval;

        // Set initial time
        const totalSeconds = intervalMinutes * 60;
        this.setState({ autosaveTimeRemaining: totalSeconds });

        // Start countdown
        this.autosaveCountdownInterval = setInterval(() => {
            this.setState(prevState => {
                // Don't countdown if paused
                if (prevState.autosavePaused) {
                    return prevState; // No change
                }

                const newTime = prevState.autosaveTimeRemaining - 1;

                if (newTime <= 0) {
                    // Time to autosave!
                    this.performAutosave();
                    return { autosaveTimeRemaining: totalSeconds }; // Reset timer
                }
                return { autosaveTimeRemaining: newTime };
            });
        }, 1000);
    }
    performAutosave () {
        if (this.state.menuBarSettings.autosave_only_when_changed && !this.props.projectChanged) return;
        // Save to the current file using the same method as manual save
        if (this.props.handleSaveProject) {
            this.props.handleSaveProject();

            if (this.state.menuBarSettings.autosave_notifications) {
                this.showAutosaveNotification('Project autosaved successfully!', 'success');
            }
        }
    }
    showAutosaveNotification(message, type = 'info') {
        // Use the toast notification system instead of manual DOM manipulation
        if (this.props.showToast) {
            this.props.showToast(message, type);
        } else {
            // Fallback to console if showToast is not available
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    formatTimeRemaining(seconds) {
        if (seconds <= 0) return '';

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${remainingSeconds}s`;
    }
    restoreOptionMessage(deletedItem) {
        switch (deletedItem) {
            case 'Sprite':
                return (<FormattedMessage
                    defaultMessage="Restore Sprite"
                    description="Menu bar item for restoring the last deleted sprite."
                    id="gui.menuBar.restoreSprite"
                />);
            case 'Sound':
                return (<FormattedMessage
                    defaultMessage="Restore Sound"
                    description="Menu bar item for restoring the last deleted sound."
                    id="gui.menuBar.restoreSound"
                />);
            case 'Costume':
                return (<FormattedMessage
                    defaultMessage="Restore Costume"
                    description="Menu bar item for restoring the last deleted costume."
                    id="gui.menuBar.restoreCostume"
                />);
            default: {
                return (<FormattedMessage
                    defaultMessage="Restore"
                    description="Menu bar item for restoring the last deleted item in its disabled state." /* eslint-disable-line max-len */
                    id="gui.menuBar.restore"
                />);
            }
        }
    }
    handleClickSeeInside() {
        this.props.onClickSeeInside();
    }
    handleClickUndo() {
        if (!this.props.isPlayerOnly && this.state.canUndo) {
            this.ensureScratchBlocks().then(ScratchBlocks => {
                const workspace = ScratchBlocks.getMainWorkspace();
                if (workspace) {
                    workspace.undo(false);
                    this.updateUndoRedoState();
                }
            });
        }
    }
    handleClickRedo() {
        if (!this.props.isPlayerOnly && this.state.canRedo) {
            this.ensureScratchBlocks().then(ScratchBlocks => {
                const workspace = ScratchBlocks.getMainWorkspace();
                if (workspace) {
                    workspace.undo(true);
                    this.updateUndoRedoState();
                }
            });
        }
    }
    updateUndoRedoState() {
        if (this.props.isPlayerOnly) return;
        this.ensureScratchBlocks().then(ScratchBlocks => {
            const workspace = ScratchBlocks.getMainWorkspace();
            if (workspace) {
                const canUndo = workspace.hasUndoStack ?
                    workspace.hasUndoStack() : (workspace.undoStack_ && workspace.undoStack_.length > 0);
                const canRedo = workspace.hasRedoStack ?
                    workspace.hasRedoStack() : (workspace.redoStack_ && workspace.redoStack_.length > 0);
                this.setState({ canUndo, canRedo });
            }
        });
    }
    buildAboutMenu(onClickAbout) {
        if (!onClickAbout) {
            // hide the button
            return null;
        }
        if (typeof onClickAbout === 'function') {
            // make a button which calls a function
            return <AboutButton onClick={onClickAbout} />;
        }
        // assume it's an array of objects
        // each item must have a 'title' FormattedMessage and a 'handleClick' function
        // generate a menu with items for each object in the array
        return (
            <MenuLabel
                open={this.props.aboutMenuOpen}
                onOpen={this.props.onRequestOpenAbout}
                onClose={this.props.onRequestCloseAbout}
            >
                <Info
                    className={styles.aboutIcon}
                    size={20}
                />
                <MenuBarMenu
                    className={classNames(styles.menuBarMenu)}
                    open={this.props.aboutMenuOpen}
                    place={this.props.isRtl ? 'right' : 'left'}
                >
                    {
                        onClickAbout.map(itemProps => {
                            const AboutIcon = {
                                computer: Computer,
                                shield: Shield,
                                info: Info,
                                code: Code
                            }[itemProps.icon];
                            return (
                                <MenuItem
                                    key={itemProps.title}
                                    isRtl={this.props.isRtl}
                                    onClick={this.wrapAboutMenuCallback(itemProps.onClick)}
                                >
                                    {AboutIcon ? <AboutIcon /> : null}
                                    {itemProps.title}
                                </MenuItem>
                            );
                        })
                    }
                </MenuBarMenu>
            </MenuLabel>
        );
    }
    wrapAboutMenuCallback(callback) {
        return () => {
            callback();
            this.props.onRequestCloseAbout();
        };
    }
    render () {
        const mistwarpAction = communityEnabled ?
            getMistWarpAction(this.state.mistwarpProject, this.props.projectChanged) :
            null;
        const saveNowMessage = (
            <FormattedMessage
                defaultMessage="Save now"
                description="Menu bar item for saving now"
                id="gui.menuBar.saveNow"
            />
        );
        const createCopyMessage = (
            <FormattedMessage
                defaultMessage="Save as a copy"
                description="Menu bar item for saving as a copy"
                id="gui.menuBar.saveAsCopy"
            />
        );
        const remixMessage = (
            <FormattedMessage
                defaultMessage="Remix"
                description="Menu bar item for remixing"
                id="gui.menuBar.remix"
            />
        );
        const newProjectMessage = (
            <FormattedMessage
                defaultMessage="New"
                description="Menu bar item for creating a new project"
                id="gui.menuBar.new"
            />
        );
        const remixButton = (
            <Button
                className={classNames(
                    styles.menuBarButton,
                    styles.remixButton
                )}
                iconClassName={styles.remixButtonIcon}
                iconElem={Shuffle}
                onClick={this.handleClickRemix}
            >
                {remixMessage}
            </Button>
        );
        // Show the About button only if we have a handler for it (like in the desktop app)
        const aboutButton = this.buildAboutMenu(this.props.onClickAbout);
        const menuBar = (
            <Box
                className={classNames(
                    this.props.className,
                    styles.menuBar,
                    {
                        [styles.iconsOnly]: this.state.menuBarSettings.menu_labels === 'icons',
                        [styles.labelsOnly]: this.state.menuBarSettings.menu_labels === 'labels'
                    }
                )}
                ref={this.menuBarRef}
            >
                <div
                    className={classNames(
                        styles.mainMenu,
                        {
                            [styles[`main-menu-align-${this.props.theme.menuBarAlign || 'center'}`]]: true
                        }
                    )}
                >
                    <a
                        href="/"
                        className={classNames(styles.menuBarItem, styles.hoverable, styles.homeLink)}
                        title={this.props.intl.formatMessage(twMessages.pinewarpHome)}
                        data-mw-item="__home"
                    >
                        <PineWarpLogo
                            className={styles.homeLogo}
                            alt={this.props.intl.formatMessage(twMessages.pinewarpLogoAlt)}
                        />
                    </a>
                    {this.state.menuCollapsed && (
                        <div
                            className={classNames(styles.menuBarItem, styles.hoverable, styles.moreMenuButton, {
                                [styles.active]: this.state.moreMenuOpen
                            })}
                            onClick={this.handleToggleMoreMenu}
                            title={this.props.intl.formatMessage(twMessages.moreMenu)}
                        >
                            <MenuIcon size={20} />
                        </div>
                    )}
                    <div
                        className={classNames(styles.fileGroup, {
                            [styles.fileGroupCollapsed]: this.state.menuCollapsed,
                            [styles.fileGroupExpanded]: this.state.menuCollapsed && this.state.moreMenuOpen
                        })}
                    >
                        {this.props.errors.length > 0 && <div data-mw-item="__errors">
                            <MenuLabel
                                open={this.props.errorsMenuOpen}
                                onOpen={this.props.onClickErrors}
                                onClose={this.props.onRequestCloseErrors}
                            >
                                <TriangleAlert size={20} />
                                <ChevronDown size={8} />
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.errorsMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                >
                                    <MenuSection>
                                        <MenuItemLink href={FEEDBACK_URL}>
                                            <FormattedMessage
                                                defaultMessage="Some scripts encountered errors."
                                                description="Link in error menu"
                                                id="tw.menuBar.reportError1"
                                            />
                                        </MenuItemLink>
                                        <MenuItemLink href={FEEDBACK_URL}>
                                            <FormattedMessage
                                                defaultMessage="This is a bug. Please report it."
                                                description="Link in error menu"
                                                id="tw.menuBar.reportError2"
                                            />
                                        </MenuItemLink>
                                    </MenuSection>
                                    <MenuSection>
                                        {this.props.errors.map(({ id, sprite, error }) => (
                                            <MenuItem key={id}>
                                                {this.props.intl.formatMessage(twMessages.compileError, {
                                                    sprite,
                                                    error
                                                })}
                                            </MenuItem>
                                        ))}
                                    </MenuSection>
                                </MenuBarMenu>
                            </MenuLabel>
                        </div>}
                        {(this.props.canManageFiles) && (
                            <MenuLabel
                                dataItem="file"
                                open={this.props.fileMenuOpen}
                                onOpen={this.handleClickFile}
                                onClose={this.props.onRequestCloseFile}
                            >
                                <FilePen
                                    width={20}
                                    height={20}
                                    size={20}
                                />
                                <span className={styles.collapsibleLabel}>
                                    <FormattedMessage
                                        defaultMessage="File"
                                        description="Text for file dropdown menu"
                                        id="gui.menuBar.file"
                                    />
                                </span>
                                <ChevronDown size={8} />
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.fileMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                >
                                    <MenuItem
                                        isRtl={this.props.isRtl}
                                        onClick={this.handleClickNew}
                                    >
                                        <FilePlusCorner />
                                        {newProjectMessage}
                                    </MenuItem>
                                    {this.props.onClickNewWindow && (
                                        <MenuItem
                                            isRtl={this.props.isRtl}
                                            onClick={this.handleClickNewWindow}
                                        >
                                            <AppWindow />
                                            <FormattedMessage
                                                defaultMessage="New window"
                                                // eslint-disable-next-line max-len
                                                description="Part of desktop app. Menu bar item that creates a new window."
                                                id="tw.menuBar.newWindow"
                                            />
                                        </MenuItem>
                                    )}
                                    {(this.props.canSave || this.props.canCreateCopy || this.props.canRemix) && (
                                        <MenuSection>
                                            {this.props.canSave && (
                                                <MenuItem
                                                    onClick={this.handleClickSave}
                                                    shortcut={formatShortcutDisplay(this.getShortcut('save'))}
                                                >
                                                    {saveNowMessage}
                                                </MenuItem>
                                            )}
                                            {this.props.canCreateCopy && (
                                                <div>
                                                    <Save />
                                                    <MenuItem
                                                        onClick={this.handleClickSaveAsCopy}
                                                        shortcut={formatShortcutDisplay(this.getShortcut('saveAs'))}
                                                    >
                                                        {createCopyMessage}
                                                    </MenuItem>
                                                </div>
                                            )}
                                            {this.props.canRemix && (
                                                <MenuItem onClick={this.handleClickRemix}>
                                                    {remixMessage}
                                                </MenuItem>
                                            )}
                                        </MenuSection>
                                    )}
                                    {this.props.roturReady ? (
                                        <MenuSection>
                                            {mistwarpAction ? (
                                                <MenuItem onClick={this.handleClickMistWarpShare}>
                                                    <Globe />
                                                    {mistwarpAction === 'remix' ? (
                                                        <FormattedMessage
                                                            defaultMessage="Remix to PineWarp"
                                                            description="File menu item to remix a PineWarp project"
                                                            id="mw.menuBar.remix"
                                                        />
                                                    ) : (
                                                        <FormattedMessage
                                                            defaultMessage="Save to PineWarp"
                                                            description="File menu item to save the project to PineWarp"
                                                            id="mw.menuBar.share"
                                                        />
                                                    )}
                                                </MenuItem>
                                            ) : null}
                                            {this.state.mistwarpProject ? (
                                                <MenuItem onClick={this.handleClickSeeMistWarpPage}>
                                                    <ExternalLink />
                                                    <FormattedMessage
                                                        defaultMessage="See project page"
                                                        description="File menu item opening the PineWarp project page"
                                                        id="mw.menuBar.projectPage"
                                                    />
                                                </MenuItem>
                                            ) : null}
                                        </MenuSection>
                                    ) : null}
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.props.onStartSelectingFileUpload}
                                            shortcut={formatShortcutDisplay(this.getShortcut('open'))}
                                        >
                                            <Upload />
                                            {this.props.intl.formatMessage(sharedMessages.loadFromComputerTitle)}
                                        </MenuItem>
                                        <SB3Downloader
                                            showSaveFilePicker={this.props.showSaveFilePicker}
                                        >
                                            {(_className, downloadProject, extended) => {
                                                // Update callbacks with saveProject method
                                                if (extended && extended.smartSave) {
                                                    updateCallbacks({
                                                        saveProject: extended.smartSave,
                                                        saveProjectAsCopy: extended.saveAsNew
                                                    });
                                                }
                                                return (
                                                    <React.Fragment>
                                                        <MenuItem
                                                            onClick={this.getSaveToComputerHandler(downloadProject)}
                                                        >
                                                            <Download />
                                                            <FormattedMessage
                                                                defaultMessage="Save to your computer"
                                                                // eslint-disable-next-line max-len
                                                                description="Menu bar item for downloading a project to your computer"
                                                                id="gui.menuBar.saveToComputer"
                                                            />
                                                        </MenuItem>
                                                    </React.Fragment>
                                                );
                                            }}
                                        </SB3Downloader>
                                    </MenuSection>
                                    {this.props.onClickPackager && (
                                        <MenuSection>
                                            <MenuItem
                                                onClick={this.handleClickPackager}
                                                shortcut={formatShortcutDisplay(this.getShortcut('print'))}
                                            >
                                                <Package />
                                                <FormattedMessage
                                                    defaultMessage="Package project"
                                                    // eslint-disable-next-line max-len
                                                    description="Menu bar item to open the current project in the packager"
                                                    id="tw.menuBar.package"
                                                />
                                            </MenuItem>
                                        </MenuSection>
                                    )}
                                    {(
                                        (this.state.gitRepoExists && this.state.gitHasChanges) ||
                                        (this.state.gitRepoExists && this.state.gitRemotes.length > 0)
                                    ) && (
                                        <MenuSection>
                                            {this.state.gitRepoExists && this.state.gitHasChanges && (
                                                <MenuItem onClick={this.handleClickGitCommit}>
                                                    <GitBranch />
                                                    <FormattedMessage
                                                        defaultMessage="Commit to Git…"
                                                        description="Menu bar item to make a git commit with a message"
                                                        id="mw.menuBar.gitCommit"
                                                    />
                                                </MenuItem>
                                            )}
                                            {this.state.gitRepoExists && this.state.gitRemotes.map(remote => (
                                                <MenuItem
                                                    key={`push-${remote.name}`}
                                                    onClick={() => this.handleClickGitPush(remote.name)}
                                                >
                                                    <Send />
                                                    <FormattedMessage
                                                        defaultMessage="Push to {remote}"
                                                        description="Menu bar item to push to a git remote"
                                                        id="mw.menuBar.gitPush"
                                                        values={{remote: remote.name}}
                                                    />
                                                </MenuItem>
                                            ))}
                                            {this.state.gitRepoExists && this.state.gitRemotes.map(remote => (
                                                <MenuItem
                                                    key={`pull-${remote.name}`}
                                                    onClick={() => this.handleClickGitPull(remote.name)}
                                                >
                                                    <Download />
                                                    <FormattedMessage
                                                        defaultMessage="Pull from {remote}"
                                                        description="Menu bar item to pull from a git remote"
                                                        id="mw.menuBar.gitPull"
                                                        values={{remote: remote.name}}
                                                    />
                                                </MenuItem>
                                            ))}
                                        </MenuSection>
                                    )}
                                    <MenuSection>
                                        <MenuItem
                                            onClick={this.handleClickRestorePoints}
                                            shortcut={formatShortcutDisplay(this.getShortcut('remix'))}
                                        >
                                            <RefreshCcw />
                                            <FormattedMessage
                                                defaultMessage="Restore points"
                                                description="Menu bar item to manage restore points"
                                                id="tw.menuBar.restorePoints"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={this.handleClickAddRestorePoint}>
                                            <ClockPlus />
                                            <FormattedMessage
                                                defaultMessage="Create restore point"
                                                description="Menu bar item to create a manual restore point immediately"
                                                id="tw.menuBar.createRestorePoint"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                    {this.getAutosaveEnabled() && (
                                        <MenuSection>
                                            <MenuItem onClick={this.handleToggleAutosave}>
                                                {this.state.autosavePaused ? <Play /> : <Pause />}
                                                {this.state.autosavePaused ? (
                                                    <FormattedMessage
                                                        defaultMessage="Resume autosave"
                                                        description="Menu bar item to resume autosave"
                                                        id="tw.menuBar.resumeAutosave"
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        defaultMessage="Pause autosave"
                                                        description="Menu bar item to pause autosave"
                                                        id="tw.menuBar.pauseAutosave"
                                                    />
                                                )}
                                                {this.getAutosaveTimeRemaining() > 0 && (
                                                    <span
                                                        style={{
                                                            marginLeft: '8px',
                                                            fontSize: '0.9em',
                                                            opacity: this.state.autosavePaused ? 0.5 : 0.7
                                                        }}
                                                    >
                                                        {'('}
                                                        {this.formatTimeRemaining(this.getAutosaveTimeRemaining())}
                                                        {')'}
                                                    </span>
                                                )}
                                            </MenuItem>
                                        </MenuSection>
                                    )}
                                </MenuBarMenu>
                            </MenuLabel>
                        )}
                        <MenuLabel
                            dataItem="edit"
                            open={this.props.editMenuOpen}
                            onOpen={this.props.onClickEdit}
                            onClose={this.props.onRequestCloseEdit}
                        >
                            <PencilRuler size={20} />
                            <span className={styles.collapsibleLabel}>
                                <FormattedMessage
                                    defaultMessage="Edit"
                                    description="Text for edit dropdown menu"
                                    id="gui.menuBar.edit"
                                />
                            </span>
                            <ChevronDown size={8} />
                            <MenuBarMenu
                                className={classNames(styles.menuBarMenu)}
                                open={this.props.editMenuOpen}
                                place={this.props.isRtl ? 'left' : 'right'}
                            >
                                <MenuSection>
                                    {this.props.isPlayerOnly ? null : (
                                        <DeletionRestorer>{(handleRestore, { restorable, deletedItem }) => (
                                            <MenuItem
                                                className={classNames({ [styles.disabled]: !restorable })}
                                                onClick={this.handleRestoreOption(handleRestore)}
                                            >
                                                <ArchiveRestore />
                                                {this.restoreOptionMessage(deletedItem)}
                                            </MenuItem>
                                        )}</DeletionRestorer>
                                    )}
                                </MenuSection>
                                <MenuSection>
                                    <MenuItem
                                        className={classNames({ [styles.disabled]: !this.state.canUndo })}
                                        onClick={this.state.canUndo ? this.handleClickUndo : null}
                                        shortcut={formatShortcutDisplay(this.getShortcut('undo'))}
                                    >
                                        <Undo />

                                        <FormattedMessage
                                            defaultMessage="Undo"
                                            description="Menu bar item for undoing"
                                            id="gui.menuBar.undo"
                                        />
                                    </MenuItem>
                                    <MenuItem
                                        className={classNames({ [styles.disabled]: !this.state.canRedo })}
                                        onClick={this.state.canRedo ? this.handleClickRedo : null}
                                        shortcut={formatShortcutDisplay(this.getShortcut('redo'))}
                                    >
                                        <Redo />

                                        <FormattedMessage
                                            defaultMessage="Redo"
                                            description="Menu bar item for redoing"
                                            id="gui.menuBar.redo"
                                        />
                                    </MenuItem>
                                </MenuSection>
                                {this.props.onToggleFractchMode && !this.props.isPlayerOnly && (
                                    <MenuSection>
                                        {false && <MenuItem
                                            onClick={() => {
                                                this.props.onRequestCloseEdit();
                                                this.props.onToggleFractchMode();
                                            }}
                                        >
                                            {this.props.fractchMode ? <BlocksIcon /> : <Code2 />}
                                            {this.props.fractchMode ? (
                                                <FormattedMessage
                                                    defaultMessage="Switch to blocks"
                                                    description="Menu bar item that leaves the Fractch code editor"
                                                    id="mw.menuBar.switchToBlocks"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Switch to Fractch"
                                                    description="Menu bar item that opens the Fractch code editor"
                                                    id="mw.menuBar.switchToFractch"
                                                />
                                            )}
                                        </MenuItem>}
                                    </MenuSection>
                                )}
                                <MenuSection>
                                    {this.props.onClickAddonSettings && (
                                        <MenuItem
                                            onClick={() => {
                                                this.props.onRequestCloseEdit();
                                                this.props.onClickAddonSettings();
                                            }}
                                        >
                                            <Puzzle />
                                            <FormattedMessage
                                                defaultMessage="Addons"
                                                description="Menu bar item to open addon settings"
                                                id="tw.menuBar.addons"
                                            />
                                        </MenuItem>
                                    )}
                                    {this.props.onClickDesktopSettings &&
                                        <TWDesktopSettings onClick={this.props.onClickDesktopSettings} />}
                                    <ChangeUsername>{changeUsername => (
                                        <MenuItem onClick={changeUsername}>
                                            <UserPen />
                                            <FormattedMessage
                                                defaultMessage="Change Username"
                                                description="Menu bar item for changing the username"
                                                id="tw.menuBar.changeUsername"
                                            />
                                        </MenuItem>
                                    )}</ChangeUsername>
                                    <TurboMode>{(toggleTurboMode, { turboMode }) => (
                                        <MenuItem onClick={toggleTurboMode}>
                                            <Zap />
                                            {turboMode ? (
                                                <FormattedMessage
                                                    defaultMessage="Turn off Turbo Mode"
                                                    description="Menu bar item for turning off turbo mode"
                                                    id="gui.menuBar.turboModeOff"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Turn on Turbo Mode"
                                                    description="Menu bar item for turning on turbo mode"
                                                    id="gui.menuBar.turboModeOn"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</TurboMode>
                                    <FramerateChanger>{(changeFramerate, { framerate }) => (
                                        <MenuItem onClick={changeFramerate}>
                                            <Gauge />
                                            {framerate === 60 ? (
                                                <FormattedMessage
                                                    defaultMessage="Turn off custom FPS Mode"
                                                    description="Menu bar item for turning off custom FPS mode"
                                                    id="tw.menuBar.60off"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Turn on custom FPS Mode"
                                                    description="Menu bar item for turning on custom FPS mode"
                                                    id="tw.menuBar.60on"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</FramerateChanger>
                                    <CloudVariablesToggler>{(toggleCloudVariables, { enabled, canUseCloudVariables }) => (
                                        <MenuItem
                                            className={classNames({ [styles.disabled]: !canUseCloudVariables })}
                                            onClick={toggleCloudVariables}
                                        >
                                            <Cloud />
                                            {canUseCloudVariables ? (
                                                enabled ? (
                                                    <FormattedMessage
                                                        defaultMessage="Disable Cloud Variables"
                                                        description="Menu bar item for disabling cloud variables"
                                                        id="tw.menuBar.cloudOff"
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        defaultMessage="Enable Cloud Variables"
                                                        description="Menu bar item for enabling cloud variables"
                                                        id="tw.menuBar.cloudOn"
                                                    />
                                                )
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Cloud Variables are not Available"
                                                    // eslint-disable-next-line max-len
                                                    description="Menu bar item for when cloud variables are not available"
                                                    id="tw.menuBar.cloudUnavailable"
                                                />
                                            )}
                                        </MenuItem>
                                    )}</CloudVariablesToggler>
                                </MenuSection>
                                <MenuSection>
                                    <MenuItem
                                        onClick={() => {
                                            this.props.onClickHelp();
                                            this.props.onRequestCloseEdit();
                                        }}
                                    >
                                        <HelpCircle />
                                        <FormattedMessage
                                            defaultMessage="Help"
                                            description="Menu bar item that opens the help window"
                                            id="mw.menuBar.help"
                                        />
                                    </MenuItem>
                                </MenuSection>
                            </MenuBarMenu>
                        </MenuLabel>
                        {this.props.isTotallyNormal && (
                            <MenuLabel
                                dataItem="mode"
                                open={this.props.modeMenuOpen}
                                onOpen={this.props.onClickMode}
                                onClose={this.props.onRequestCloseMode}
                            >
                                <FormattedMessage
                                    defaultMessage="Mode"
                                    description="Mode menu item in the menu bar"
                                    id="gui.menuBar.modeMenu"
                                />
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.modeMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                >
                                    <MenuSection>
                                        <MenuItem onClick={this.handleSetMode('NOW')}>
                                            <span className={classNames({ [styles.inactive]: !this.props.modeNow })}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Normal mode"
                                                description="April fools: resets editor to not have any pranks"
                                                id="gui.menuBar.normalMode"
                                            />
                                        </MenuItem>
                                        <MenuItem onClick={this.handleSetMode('2020')}>
                                            <span className={classNames({ [styles.inactive]: !this.props.mode2020 })}>
                                                {'✓'}
                                            </span>
                                            {' '}
                                            <FormattedMessage
                                                defaultMessage="Caturday mode"
                                                description="April fools: Cat blocks mode"
                                                id="gui.menuBar.caturdayMode"
                                            />
                                        </MenuItem>
                                    </MenuSection>
                                </MenuBarMenu>
                            </MenuLabel>
                        )}
                        <MenuLabel
                            dataItem="tools"
                            open={this.props.toolsMenuOpen}
                            onOpen={this.props.onClickTools}
                            onClose={this.props.onRequestCloseTools}
                        >
                            <Wrench size={20} />
                            <span className={styles.collapsibleLabel}>
                                <FormattedMessage
                                    defaultMessage="Tools"
                                    description="Text for tools dropdown menu"
                                    id="gui.menuBar.tools"
                                />
                            </span>
                            <ChevronDown size={8} />
                            <MenuBarMenu
                                className={classNames(styles.menuBarMenu)}
                                open={this.props.toolsMenuOpen}
                                place={this.props.isRtl ? 'left' : 'right'}
                            >
                                <MenuSection>
                                    <MenuItem
                                        onClick={() => {
                                            this.props.onClickGitModal();
                                            this.props.onRequestCloseTools();
                                        }}
                                    >
                                        <GitBranch />
                                        <FormattedMessage
                                            defaultMessage="Git"
                                            description="Menu bar item to open git window"
                                            id="mw.menuBar.git"
                                        />
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            import('../../lib/mw/open-fractch-terminal-window.js')
                                                .then(module => module.default({vm: this.props.vm}))
                                                .catch(e => console.error(e));
                                            this.props.onRequestCloseTools();
                                        }}
                                    >
                                        <TerminalSquare />
                                        <FormattedMessage
                                            defaultMessage="Terminal"
                                            description="Menu bar item that opens the shell in a window"
                                            id="mw.menuBar.terminal"
                                        />
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            this.props.onClickCollaboration();
                                            this.props.onRequestCloseTools();
                                        }}
                                    >
                                        <Handshake size={20} />
                                        <FormattedMessage
                                            defaultMessage="Live Collaboration"
                                            description="Menu bar item for live collaboration"
                                            id="tw.menuBar.collaboration"
                                        />
                                    </MenuItem>
                                    <MenuItem onClick={this.handleClickProjectMetadata}>
                                        <Info />
                                        <FormattedMessage
                                            defaultMessage="Project metadata"
                                            // eslint-disable-next-line max-len
                                            description="Menu bar item to view the open project's metadata (author, dates, contents)"
                                            id="mw.menuBar.projectMetadata"
                                        />
                                    </MenuItem>
                                </MenuSection>
                                {window.__pinewarpDebuggerToggle || window.__pinewarpVariableManagerToggle ||
                                    window.__pinewarpPerfToggle ? (
                                    <MenuSection>
                                        {window.__pinewarpPerfToggle && (
                                            <MenuItem
                                                onClick={() => {
                                                    window.__pinewarpPerfToggle();
                                                    this.props.onRequestCloseTools();
                                                }}
                                            >
                                                <Gauge />
                                                <FormattedMessage
                                                    defaultMessage="Performance"
                                                    description="Menu bar item to toggle the performance analysis panel"
                                                    id="pine.menuBar.perfPanel"
                                                />
                                            </MenuItem>
                                        )}
                                        {window.__pinewarpDebuggerToggle && (
                                            <MenuItem
                                                onClick={() => {
                                                    window.__pinewarpDebuggerToggle();
                                                    this.props.onRequestCloseTools();
                                                }}
                                            >
                                                <Bug />
                                                <FormattedMessage
                                                    defaultMessage="Debugger"
                                                    description="Menu bar item to toggle the debugger"
                                                    id="tw.menuBar.debugger"
                                                />
                                            </MenuItem>
                                        )}
                                        {window.__pinewarpVariableManagerToggle && (
                                            <MenuItem
                                                onClick={() => {
                                                    window.__pinewarpVariableManagerToggle();
                                                    this.props.onRequestCloseTools();
                                                }}
                                            >
                                                <Database />
                                                <FormattedMessage
                                                    defaultMessage="Variable Manager"
                                                    description="Menu bar item to toggle the variable manager"
                                                    id="tw.menuBar.variableManager"
                                                />
                                            </MenuItem>
                                        )}
                                    </MenuSection>
                                ) : null}
                                {window.__pinewarpTodoToggle || window.__pinewarpSPAToggle ? (
                                    <MenuSection>
                                        {window.__pinewarpSPAToggle && (
                                            <MenuItem
                                                onClick={() => {
                                                    window.__pinewarpSPAToggle();
                                                    this.props.onRequestCloseTools();
                                                }}
                                            >
                                                <ChartColumn />
                                                <FormattedMessage
                                                    defaultMessage="Simple Project Analyzer"
                                                    description="Menu bar item to toggle the simple project analyzer"
                                                    id="tw.menuBar.spa"
                                                />
                                            </MenuItem>
                                        )}
                                        {window.__pinewarpTodoToggle && (
                                            <MenuItem
                                                onClick={() => {
                                                    window.__pinewarpTodoToggle();
                                                    this.props.onRequestCloseTools();
                                                }}
                                            >
                                                <ListTodo />
                                                <FormattedMessage
                                                    defaultMessage="ToDo"
                                                    description="Menu bar item to toggle the ToDo"
                                                    id="tw.menuBar.todo"
                                                />
                                            </MenuItem>
                                        )}
                                    </MenuSection>
                                ) : null}
                                <MenuSection>
                                    <MenuItem
                                        onClick={() => {
                                            this.props.onRequestCloseTools();
                                            this.props.onOpenExtensionLibrary();
                                        }}
                                        shortcut={formatShortcutDisplay(this.getShortcut('backpack'))}
                                    >
                                        <PackagePlus />
                                        <FormattedMessage
                                            defaultMessage="Add Extension"
                                            description="Menu bar item for adding or importing extensions"
                                            id="tw.menuBar.extensions.addImport"
                                        />
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            this.props.onRequestCloseTools();
                                            this.props.onOpenExtensionManagerModal();
                                        }}
                                        shortcut={formatShortcutDisplay(this.getShortcut('extensionManager'))}
                                    >
                                        <FileCog />
                                        <FormattedMessage
                                            defaultMessage="Manage Extensions"
                                            description="Menu bar item for managing loaded extensions"
                                            id="tw.menuBar.extensions.manage"
                                        />
                                    </MenuItem>
                                </MenuSection>
                            </MenuBarMenu>
                        </MenuLabel>
                        {!this.props.isPlayerOnly && (
                            <MenuLabel
                                ref={this.workspaceBookmarksMenuLabelRef}
                                dataItem="bookmarks"
                                open={this.props.workspaceBookmarksMenuOpen}
                                onOpen={this.props.onClickWorkspaceBookmarks}
                                onClose={this.props.onRequestCloseWorkspaceBookmarks}
                                disableClose={this.state.isEditingWorkspaceBookmark}
                            >
                                <Bookmark size={20} />
                                <span className={styles.collapsibleLabel}>
                                    <FormattedMessage
                                        defaultMessage="Bookmarks"
                                        description="Workspace bookmarks menu label"
                                        id="tw.workspaceBookmarks.menuLabel"
                                    />
                                </span>
                                <ChevronDown size={8} />
                                <MenuBarMenu
                                    className={classNames(styles.menuBarMenu)}
                                    open={this.props.workspaceBookmarksMenuOpen}
                                    place={this.props.isRtl ? 'left' : 'right'}
                                >
                                    <WorkspaceBookmarksMenu
                                        bookmarks={this.state.workspaceBookmarks}
                                        categories={this.state.workspaceBookmarksCategories}
                                        collapsedCategories={this.state.workspaceBookmarksCollapsedCategories}
                                        enableCategories
                                        showSearch
                                        intl={this.props.intl}
                                        onAddBookmark={this.handleAddWorkspaceBookmark}
                                        onSwitchToBookmark={this.handleSwitchWorkspaceBookmark}
                                        onEditBookmark={this.handleEditWorkspaceBookmark}
                                        onDeleteBookmark={this.handleDeleteWorkspaceBookmark}
                                        onToggleCategoryCollapsed={this.handleToggleWorkspaceBookmarkCategoryCollapsed}
                                        onExport={this.handleExportWorkspaceBookmarks}
                                        onImport={this.handleImportWorkspaceBookmarks}
                                        onClearAll={this.handleClearAllWorkspaceBookmarks}
                                    />
                                </MenuBarMenu>
                            </MenuLabel>
                        )}
                        {(this.props.canChangeTheme || this.props.canChangeLanguage) && <SettingsMenu />}
                    </div>

                    {!this.props.isPlayerOnly && mediaRecorderSupported &&
                        this.state.menuBarSettings.show_media_recorder && (
                        <MediaRecorderButton
                            className={classNames(styles.menuBarItem, styles.hoverable)}
                            labelClassName={styles.collapsibleLabel}
                            projectTitle={this.props.projectTitle}
                            vm={this.props.vm}
                        />
                    )}
                    {!this.props.isPlayerOnly && (
                        <button
                            className="sa-block-count-display"
                            data-mw-item="block-count"
                            ref={this.blockCountRef}
                        />
                    )}

                    <div
                        data-mw-item="__divider"
                        className={styles.menuBarLayoutItem}
                    >
                        <Divider className={styles.divider} />
                    </div>

                    {this.props.canEditTitle ? (
                        <div
                            data-mw-item="project-title"
                            className={classNames(styles.menuBarItem, styles.growable)}
                        >
                            <MenuBarItemTooltip
                                enable
                                id="title-field"
                            >
                                <ProjectTitleInput
                                    className={classNames(styles.titleFieldGrowable)}
                                />
                            </MenuBarItemTooltip>
                        </div>
                    ) : ((this.props.authorUsername && this.props.authorUsername !== this.props.username) ? (
                        <AuthorInfo
                            className={styles.authorInfo}
                            imageUrl={this.props.authorThumbnailUrl}
                            projectId={this.props.projectId}
                            projectTitle={this.props.projectTitle}
                            userId={this.props.authorId}
                            username={this.props.authorUsername}
                        />
                    ) : null)}

                    {(this.props.isShowingProject || this.props.isUpdating) &&
                        this.props.projectId && this.props.projectId !== '0' ? (
                            <div
                                data-mw-item="__view-counter"
                                className={classNames(styles.menuBarItem, styles.viewCounter)}
                            >
                                <TWViewCounter projectId={this.props.projectId} />
                            </div>
                        ) : null}
                    {this.props.canShare ? (
                        (this.props.isShowingProject || this.props.isUpdating) && (
                            <div
                                data-mw-item="share"
                                className={classNames(styles.menuBarItem)}
                            >
                                <ProjectWatcher onDoneUpdating={this.props.onSeeCommunity}>
                                    {
                                        waitForUpdate => (
                                            <ShareButton
                                                className={styles.menuBarButton}
                                                isShared={this.props.isShared}
                                                /* eslint-disable react/jsx-no-bind */
                                                onClick={() => {
                                                    this.handleClickShare(waitForUpdate);
                                                }}
                                            /* eslint-enable react/jsx-no-bind */
                                            />
                                        )
                                    }
                                </ProjectWatcher>
                            </div>
                        )
                    ) : this.props.showComingSoon ? (
                        <div
                            data-mw-item="share"
                            className={classNames(styles.menuBarItem)}
                        >
                            <MenuBarItemTooltip id="share-button">
                                <ShareButton className={styles.menuBarButton} />
                            </MenuBarItemTooltip>
                        </div>
                    ) : null}
                    {this.props.canRemix && (
                        <div
                            data-mw-item="remix"
                            className={classNames(styles.menuBarItem)}
                        >
                            {remixButton}
                        </div>
                    )}
                </div>

                <div
                    data-mw-item="__account-group"
                    className={styles.accountInfoGroup}
                >
                    <div
                        data-mw-item="save-status"
                        className={styles.menuBarLayoutItem}
                    >
                        <TWSaveStatus
                            showSaveFilePicker={this.props.showSaveFilePicker}
                        />
                    </div>
                    {aboutButton && (
                        <div
                            data-mw-item="about"
                            className={styles.menuBarLayoutItem}
                        >
                            {aboutButton}
                        </div>
                    )}
                    <div
                        data-mw-item="collab-presence"
                        className={styles.menuBarLayoutItem}
                    >
                        <CollabPresence />
                    </div>
                    <div
                        data-mw-item="mw-editor-nav"
                        className={styles.menuBarLayoutItem}
                    >
                        <MwEditorNav />
                    </div>
                    <div
                        data-mw-item="rotur-account"
                        className={classNames(styles.menuBarLayoutItem, styles.roturAccountSlot)}
                    >
                        <RoturAccount />
                    </div>
                </div>
            </Box>
        );

        return (
            <React.Fragment>
                {menuBar}
                <TWNews />
            </React.Fragment>
        );
    }
}

MenuBar.propTypes = {
    enableSeeInside: PropTypes.bool,
    onClickSeeInside: PropTypes.func,
    aboutMenuOpen: PropTypes.bool,
    accountMenuOpen: PropTypes.bool,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    autoUpdateProject: PropTypes.func,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    customShortcuts: PropTypes.object,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    className: PropTypes.string,
    logo: PropTypes.string,
    errors: PropTypes.arrayOf(PropTypes.shape({
        sprite: PropTypes.string,
        error: PropTypes.string,
        id: PropTypes.number
    })),
    errorsMenuOpen: PropTypes.bool,
    onClickErrors: PropTypes.func,
    onRequestCloseErrors: PropTypes.func,
    confirmReadyToReplaceProject: PropTypes.func,
    currentLocale: PropTypes.string.isRequired,
    editMenuOpen: PropTypes.bool,
    fractchMode: PropTypes.bool,
    onToggleFractchMode: PropTypes.func,
    editorMenuOpen: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    fileMenuOpen: PropTypes.bool,
    workspaceBookmarksMenuOpen: PropTypes.bool,
    toolsMenuOpen: PropTypes.bool,
    handleSaveProject: PropTypes.func,
    intl: intlShape,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isShowingProject: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    isUpdating: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    loginMenuOpen: PropTypes.bool,
    mode1920: PropTypes.bool,
    mode1990: PropTypes.bool,
    mode2020: PropTypes.bool,
    mode220022BC: PropTypes.bool,
    modeMenuOpen: PropTypes.bool,
    modeNow: PropTypes.bool,
    onClickAbout: PropTypes.oneOfType([
        PropTypes.func, // button mode: call this callback when the About button is clicked
        PropTypes.arrayOf( // menu mode: list of items in the About menu
            PropTypes.shape({
                title: PropTypes.string, // text for the menu item
                onClick: PropTypes.func // call this callback when the menu item is clicked
            })
        )
    ]),
    onClickAccount: PropTypes.func,
    onClickAddonSettings: PropTypes.func,
    onClickCollaboration: PropTypes.func,
    onClickDesktopSettings: PropTypes.func,
    onClickPackager: PropTypes.func,
    onClickRestorePoints: PropTypes.func,
    onClickProjectMetadata: PropTypes.func,
    onClickAddRestorePoint: PropTypes.func,
    onClickExtensionManager: PropTypes.func,
    openSimpleDialog: PropTypes.func.isRequired,
    showToast: PropTypes.func,
    onClickEdit: PropTypes.func,
    onClickEditor: PropTypes.func,
    onClickFile: PropTypes.func,
    onClickWorkspaceBookmarks: PropTypes.func,
    onClickLogin: PropTypes.func,
    onClickMode: PropTypes.func,
    onClickNew: PropTypes.func,
    onClickNewWindow: PropTypes.func,
    onClickRemix: PropTypes.func,
    onClickSave: PropTypes.func,
    onClickSaveAsCopy: PropTypes.func,
    onClickPreferencesModal: PropTypes.func,
    onClickGitModal: PropTypes.func,
    onClickHelp: PropTypes.func,

    onOpenSettingsModal: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenExtensionLibrary: PropTypes.func,
    onOpenExtensionManagerModal: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onOpenTipLibrary: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onRequestCloseAbout: PropTypes.func,
    onRequestCloseAccount: PropTypes.func,
    onRequestCloseEdit: PropTypes.func,
    onRequestCloseEditor: PropTypes.func,
    onRequestCloseFile: PropTypes.func,
    onRequestCloseWorkspaceBookmarks: PropTypes.func,
    onRequestCloseLogin: PropTypes.func,
    onRequestCloseMode: PropTypes.func,
    onClickTools: PropTypes.func,
    onRequestCloseTools: PropTypes.func,
    onRequestOpenAbout: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onSetTimeTravelMode: PropTypes.func,
    onShare: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string,
    projectChanged: PropTypes.bool,
    roturReady: PropTypes.bool,
    onProjectUnchanged: PropTypes.func,
    onShowGitStatus: PropTypes.func,
    onCloseGitStatus: PropTypes.func,
    onGitStatusDone: PropTypes.func,
    renderLogin: PropTypes.func,
    sessionExists: PropTypes.bool,
    showSaveFilePicker: PropTypes.func,
    showComingSoon: PropTypes.bool,
    theme: PropTypes.shape({
        menuBarAlign: PropTypes.string
    }),
    username: PropTypes.string,
    userOwnsProject: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired,
    customShortcuts: PropTypes.object
};

MenuBar.contextTypes = {
    store: PropTypes.object
};

MenuBar.defaultProps = {
    onShare: () => { }
};

const mapStateToProps = (state, ownProps) => {
    const loadingState = state.scratchGui.projectState.loadingState;
    const user = state.session && state.session.session && state.session.session.user;
    return {
        authorUsername: state.scratchGui.tw.author.username,
        authorThumbnailUrl: state.scratchGui.tw.author.thumbnail,
        projectId: state.scratchGui.projectState.projectId,
        aboutMenuOpen: aboutMenuOpen(state),
        accountMenuOpen: accountMenuOpen(state),
        currentLocale: state.locales.locale,
        customShortcuts: state.scratchGui.shortcuts.customShortcuts,
        fileMenuOpen: fileMenuOpen(state),
        editMenuOpen: editMenuOpen(state),
        workspaceBookmarksMenuOpen: workspaceBookmarksMenuOpen(state),
        errors: state.scratchGui.tw.compileErrors,
        errorsMenuOpen: errorsMenuOpen(state),
        toolsMenuOpen: toolsMenuOpen(state),
        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
        isRtl: state.locales.isRtl,
        isUpdating: getIsUpdating(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        locale: state.locales.locale,
        loginMenuOpen: loginMenuOpen(state),
        modeMenuOpen: modeMenuOpen(state),
        projectTitle: state.scratchGui.projectTitle,
        projectChanged: state.scratchGui.projectChanged,
        roturReady: state.scratchGui.rotur && state.scratchGui.rotur.status === 'ready',
        sessionExists: state.session && typeof state.session.session !== 'undefined',
        theme: state.scratchGui.theme.theme,
        username: user ? user.username : null,
        userOwnsProject: ownProps.authorUsername && user &&
            (ownProps.authorUsername === user.username),
        vm: state.scratchGui.vm,
        mode220022BC: isTimeTravel220022BC(state),
        mode1920: isTimeTravel1920(state),
        mode1990: isTimeTravel1990(state),
        mode2020: isTimeTravel2020(state),
        modeNow: isTimeTravelNow(state)
    };
};

const mapDispatchToProps = dispatch => ({
    onClickSeeInside: () => dispatch(setPlayer(false)),
    autoUpdateProject: () => dispatch(autoUpdateProject()),
    onOpenTipLibrary: () => dispatch(openTipsLibrary()),
    onClickAccount: () => dispatch(openAccountMenu()),
    onRequestCloseAccount: () => dispatch(closeAccountMenu()),
    onClickCollaboration: () => dispatch(openCollaborationModal()),
    onClickFile: () => dispatch(openFileMenu()),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onProjectUnchanged: () => dispatch(setProjectUnchanged()),
    onShowGitStatus: alertId => dispatch(showStandardAlert(alertId)),
    onCloseGitStatus: alertId => dispatch(closeAlertWithId(alertId)),
    onGitStatusDone: alertId => showAlertWithTimeout(dispatch, alertId),
    onClickWorkspaceBookmarks: () => dispatch(openWorkspaceBookmarksMenu()),
    onRequestCloseWorkspaceBookmarks: () => dispatch(closeWorkspaceBookmarksMenu()),
    onClickEdit: () => dispatch(openEditMenu()),
    onRequestCloseEdit: () => dispatch(closeEditMenu()),
    onClickErrors: () => dispatch(openErrorsMenu()),
    onRequestCloseErrors: () => dispatch(closeErrorsMenu()),
    onClickTools: () => dispatch(openToolsMenu()),
    onRequestCloseTools: () => dispatch(closeToolsMenu()),
    onClickLogin: () => dispatch(openLoginMenu()),
    onRequestCloseLogin: () => dispatch(closeLoginMenu()),
    onClickMode: () => dispatch(openModeMenu()),
    onRequestCloseMode: () => dispatch(closeModeMenu()),
    onRequestOpenAbout: () => dispatch(openAboutMenu()),
    onRequestCloseAbout: () => dispatch(closeAboutMenu()),
    onClickRestorePoints: () => dispatch(openRestorePointModal()),
    onClickProjectMetadata: () => dispatch(openProjectMetadataModal()),
    onClickExtensionManager: () => dispatch(openExtensionManagerModal()),
    onClickGitModal: () => {
        dispatch(closeEditMenu());
        dispatch(openGitModal());
    },
    onClickHelp: () => dispatch(openHelp()),
    onOpenSettingsModal: () => dispatch(openSettingsModal()),
    onClickNew: needSave => {
        dispatch(setPlayer(false));
        dispatch(requestNewProject(needSave));
        dispatch(setFileHandle(null));
    },
    onClickRemix: () => dispatch(remixProject()),
    onClickSave: () => dispatch(manualUpdateProject()),
    onClickSaveAsCopy: () => dispatch(saveProjectAsCopy()),
    onSeeCommunity: () => dispatch(setPlayer(true)),
    onSetTimeTravelMode: mode => dispatch(setTimeTravel(mode))
});

export default compose(
    injectIntl,
    MenuBarHOC,
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(MenuBar);
