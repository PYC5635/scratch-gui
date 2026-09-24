import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect, Provider} from 'react-redux';
import {FormattedMessage, IntlProvider} from 'react-intl';

import WindowManager from '../addons/window-system/window-manager';
import Box from '../components/box/box.jsx';
import './windowed-modal.css';

class WindowedModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'addEventListeners',
            'removeEventListeners',
            'handlePopState',
            'pushHistory',
            'handleWindowClose',
            'handleWindowMinimize',
            'handleWindowMove',
            'handleWindowResize',
            'scheduleBlocklyWidgetReposition'
        ]);
        this.window = null;
        this.contentContainer = null;
        this.createdWindow = false;
        this.windowId = this.props.id || 'modal-window';
        this.blocklyWidgetRepositionRaf_ = null;
        this._resizeContentRafPending = false;
        this.addEventListeners();
    }
    
    componentDidMount () {
        if (this.props.visible === false) {
            return;
        }
        this.createWindow();
        // Add a history event only if it's not currently for our modal. This
        // avoids polluting the history with many entries. We only need one.
        this.pushHistory(this.id, (history.state === null || history.state !== this.id));

        if (this.window) {
            this.window.show();
        }

        this.resizeToContentIfNeeded();
    }
    
    componentDidUpdate (prevProps) {
        // Handle visibility changes
        if (this.props.visible !== prevProps.visible) {
            if (this.props.visible && !this.window) {
                // Modal should be visible but window doesn't exist - create it
                this.createWindow();
                this.pushHistory(this.id, (history.state === null || history.state !== this.id));
            } else if (!this.props.visible && this.window) {
                // Modal should be hidden but window exists - hide it
                if (!this.window.isDestroying) {
                    this.window.hide();
                }
                return;
            }
        }
        
        // Show/hide window based on visibility
        if (this.window) {
            if (this.props.visible === false) {
                // If the window is already being destroyed (its close button
                // was clicked), the closing animation is in progress and the
                // element will be removed by the window system — don't hide it
                // again here or we'd cancel that removal.
                if (!this.window.isDestroying) {
                    this.window.hide();
                }
            } else if (!this.window.isDestroying) {
                // Likewise, don't call show() while the window is being
                // destroyed — that would cancel the closing animation, clear
                // the _animTimer, and re-display the window, leaving an
                // orphaned element that can never be closed again.
                this.window.show();
            }
        }
        
        // Update content if window exists
        if (this.window && this.contentContainer) {
            // React will handle rendering through the portal
        }

        this.resizeToContentIfNeeded();
    }

    componentWillUnmount () {
        this.removeEventListeners();
        if (this.blocklyWidgetRepositionRaf_) {
            window.cancelAnimationFrame(this.blocklyWidgetRepositionRaf_);
            this.blocklyWidgetRepositionRaf_ = null;
        }
        this._resizeContentRafPending = false;
        if (this.window) {
            // If the window is already being destroyed by the window system
            // (e.g. its close button was clicked), don't hide it again here or
            // we'd cancel the closing animation that is already in progress.
            if (!this.window.isDestroying) {
                this.window.hide();
            }
        }
    }

    scheduleBlocklyWidgetReposition () {
        if (this.blocklyWidgetRepositionRaf_) return;

        this.blocklyWidgetRepositionRaf_ = window.requestAnimationFrame(() => {
            this.blocklyWidgetRepositionRaf_ = null;
            const ScratchBlocks = window.ScratchBlocks;
            if (!ScratchBlocks || !ScratchBlocks.WidgetDiv) return;
            if (typeof ScratchBlocks.WidgetDiv.isVisible === 'function' && !ScratchBlocks.WidgetDiv.isVisible()) return;

            try {
                // FieldTextInput positions itself with extra alignment logic in resizeEditor_.
                // Calling it keeps the editor's left/top correct when the modal window moves.
                const owner = ScratchBlocks.WidgetDiv.owner_;
                if (owner && typeof owner.resizeEditor_ === 'function') {
                    owner.resizeEditor_();
                } else if (typeof ScratchBlocks.WidgetDiv.repositionForWindowResize === 'function') {
                    ScratchBlocks.WidgetDiv.repositionForWindowResize();
                }
            } catch (e) {
                // Never allow a reposition failure to break window dragging.
            }
        });
    }

    handleWindowMove () {
        this.scheduleBlocklyWidgetReposition();
    }

    handleWindowResize () {
        this.scheduleBlocklyWidgetReposition();
    }

    resizeToContentIfNeeded () {
        if (!this.window || !this.contentContainer) return;
        if (this.props.id !== 'mwProjectThemeModal' && this.props.id !== 'simpleDialog') return;

        // Avoid queuing multiple RAF callbacks when called rapidly
        if (this._resizeContentRafPending) return;
        this._resizeContentRafPending = true;

        window.requestAnimationFrame(() => {
            this._resizeContentRafPending = false;
            if (!this.window || !this.contentContainer) return;

            const headerHeight = this.window.headerElement ? this.window.headerElement.offsetHeight : 0;
            const contentHeight = this.contentContainer.scrollHeight;
            const desiredHeight = Math.max(0, headerHeight + contentHeight);

            if (!desiredHeight || !Number.isFinite(desiredHeight)) return;

            // Skip if height hasn't changed to avoid unnecessary layout recalculations
            const currentHeight = this.window.height;
            if (desiredHeight === currentHeight) return;

            this.window.height = desiredHeight;
            this.window.element.style.height = `${desiredHeight}px`;

            if (this.props.id === 'mwProjectThemeModal') {
                this.window.minHeight = desiredHeight;
                this.window.maxHeight = desiredHeight;
            }
        });
    }
    
    createWindow () {
        // Prevent creating duplicate windows
        if (this.window) {
            return;
        }
        
        const windowId = this.props.id || 'modal-window';
        this.windowId = windowId;
        const existingWindow = WindowManager.getWindow(windowId);
        if (existingWindow) {
            this.window = existingWindow;
            this.contentContainer = this.window.contentElement;
            this.createdWindow = false;
            
            this.contentContainer.innerHTML = '';
            
            const newTitle = typeof this.props.contentLabel === 'string' ? this.props.contentLabel : 'Dialog';
            if (this.window.title !== newTitle) {
                this.window.title = newTitle;
                const titleElement = this.window.element.querySelector('.addon-window-title');
                if (titleElement) {
                    titleElement.textContent = newTitle;
                }
            }
            
            if (this.props.visible === false) {
                this.window.hide();
            } else {
                this.window.show();
            }
            this.forceUpdate();
            this.resizeToContentIfNeeded();
            
            return;
        }
        
        const {
            id,
            contentLabel,
            className = '',
            fullScreen = false
        } = this.props;
        
        // Determine window size based on content type
        let width = this.props.width || 600;
        let height = this.props.height || 500;
        const resizable = this.props.resizable !== false;
        const maximizable = this.props.maximizable !== false;
        const minWidth = this.props.minWidth || 400;
        const minHeight = this.props.minHeight || 300;
        const maxWidth = this.props.maxWidth || null;
        const maxHeight = this.props.maxHeight || null;
    
        if (fullScreen) {
            width = Math.min(1200, window.innerWidth - 100);
            height = Math.min(800, window.innerHeight - 100);
        }
        
        this.window = WindowManager.createWindow({
            id: id || 'modal-window',
            title: typeof contentLabel === 'string' ? contentLabel : 'Dialog',
            width,
            height,
            minWidth,
            minHeight,
            maxWidth,
            maxHeight,
            resizable,
            maximizable,
            closable: true,
            className: `modal-window ${className}`,
            modal: true,
            alwaysOnTop: id === 'unknownPlatformModal' || id === 'securitymanagermodal',
            destroyOnMinimize: true,
            onClose: this.handleWindowClose,
            onMinimize: this.handleWindowMinimize,
            onMove: this.handleWindowMove,
            onResize: this.handleWindowResize
        });
        this.createdWindow = true;

        if (this.props.centered && this.window.center) {
            this.window.center();
        }

        // Create content container with modal styling
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'modal-window-content windowed-modal-content';
        this.contentContainer.style.cssText = `
            height: 100%;
            max-height: 100%;
            display: flex;
            flex-direction: column;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            background: var(--ui-modal-background, #fff);
            color: var(--ui-modal-foreground, #000);
            overflow: hidden;
            min-height: 0;
        `;

        if (id === 'mwProjectThemeModal') {
            this.contentContainer.style.height = 'auto';
            this.contentContainer.style.maxHeight = 'none';
            this.contentContainer.style.overflow = 'visible';
        }
        
        this.window.setContent(this.contentContainer);
        this.forceUpdate(); // Force re-render now that container is available
        // Don't auto-show here, let componentDidUpdate handle visibility
    }
    
    renderContent () {
        if (!this.contentContainer) return null;
        
        const {
            children,
            headerImage,
            contentLabel,
            onHelp,
            isRtl,
            showHeader = false,
            locale,
            messages
        } = this.props;
        
        const modalContent = React.createElement(
            Box,
            {
                dir: isRtl ? 'rtl' : 'ltr',
                direction: 'column',
                grow: 1,
                style: {
                    height: '100%',
                    overflow: 'hidden'
                }
            },
            // Header (only if showHeader is true)
            showHeader && React.createElement(
                'div',
                {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '1rem',
                        borderBottom: '1px solid var(--ui-tertiary, #ccc)',
                        background: 'var(--ui-secondary, #f8f8f8)',
                        flexShrink: 0
                    }
                },
                // Help button
                onHelp && React.createElement(
                    'button',
                    {
                        onClick: onHelp,
                        style: {
                            marginRight: '1rem',
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                        }
                    },
                    React.createElement(FormattedMessage, {
                        defaultMessage: 'Help',
                        description: 'Help button in modal',
                        id: 'gui.modal.help'
                    })
                ),
                // Header image
                headerImage && React.createElement('img', {
                    src: headerImage,
                    style: {marginRight: '1rem', maxHeight: '24px'},
                    draggable: false
                }),
                // Title
                React.createElement(
                    'div',
                    {
                        style: {
                            flex: 1,
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                        }
                    },
                    typeof contentLabel === 'string' ? contentLabel : contentLabel
                )
            ),
            // Content
            React.createElement(
                'div',
                {
                    style: {
                        flex: 1,
                        overflow: 'hidden',
                        minHeight: 0,
                        height: '100%',
                        maxHeight: '100%',
                        width: '100%',
                        padding: '0',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                },
                children
            )
        );
        
        // Wrap the content with both Redux Provider and IntlProvider to provide full context
        const wrappedContent = React.createElement(
            Provider,
            {
                store: this.props.store
            },
            React.createElement(
                IntlProvider,
                {
                    locale: locale || 'en',
                    messages: messages || {}
                },
                modalContent
            )
        );
        
        // Use React portal to render content into the window container
        return ReactDOM.createPortal(wrappedContent, this.contentContainer);
    }
    
    handleWindowClose = () => {
        // Delay onRequestClose until after the window's closing animation
        // completes. Calling it synchronously would usually dispatch a Redux
        // close action, making the parent unmount this modal and clearing the
        // portal content while the animation is still playing - the content
        // would vanish instantly and it would look like there is no close
        // animation at all. Deferring it lets the whole window (content
        // included) fade out together. If the modal is reopened before the
        // timer fires, this.window will have been replaced by a fresh window,
        // so don't clear that one.
        const closingWindow = this.window;
        setTimeout(() => {
            if (this.props.onRequestClose) {
                const shouldClose = this.props.onRequestClose();
                if (shouldClose === false) {
                    return;
                }
            }
            if (this.window === closingWindow) {
                this.window = null;
                this.contentContainer = null;
                this.createdWindow = false;
            }
        }, 220);
    };
    
    handleWindowMinimize = () => {
        // Delay Redux update and cleanup until after the close animation completes.
        // This ensures the portal content stays visible during the animation.
        // Use 220ms to ensure the destroy() animation (200ms) finishes first.
        const closingWindow = this.window;
        setTimeout(() => {
            if (this.props.onRequestClose) {
                const shouldClose = this.props.onRequestClose();
                if (shouldClose === false) {
                    return;
                }
            }
            if (this.window === closingWindow) {
                this.window = null;
                this.contentContainer = null;
                this.createdWindow = false;
            }
        }, 220);
    };
    
    addEventListeners () {
        window.addEventListener('popstate', this.handlePopState);
    }
    
    removeEventListeners () {
        window.removeEventListener('popstate', this.handlePopState);
    }
    
    handlePopState () {
        // Whenever someone navigates, we want to be closed
        if (this.props.onRequestClose) {
            this.props.onRequestClose();
        }
    }
    
    get id () {
        return `modal-${this.props.id}`;
    }
    
    pushHistory (state, push) {
        if (push) return history.pushState(state, this.id, null);
        history.replaceState(state, this.id, null);
    }
    
    render () {
        // Always try to render content if we have a container
        if (this.contentContainer) {
            return this.renderContent();
        }
        return null;
    }
}

WindowedModal.propTypes = {
    id: PropTypes.string.isRequired,
    isRtl: PropTypes.bool,
    onRequestClose: PropTypes.func,
    children: PropTypes.node,
    className: PropTypes.string,
    centered: PropTypes.bool,
    contentLabel: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
    ]).isRequired,
    fullScreen: PropTypes.bool,
    headerImage: PropTypes.string,
    onHelp: PropTypes.func,
    showHeader: PropTypes.bool,
    visible: PropTypes.bool,
    locale: PropTypes.string,
    messages: PropTypes.object,
    store: PropTypes.object.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    resizable: PropTypes.bool,
    maximizable: PropTypes.bool,
    minWidth: PropTypes.number,
    minHeight: PropTypes.number,
    maxWidth: PropTypes.number,
    maxHeight: PropTypes.number
};

const mapStateToProps = state => ({
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    messages: state.locales.messages
});

const ConnectedWindowedModal = connect(
    mapStateToProps
)(WindowedModal);

// Wrapper component to access store from context
const WindowedModalWithStore = (props, context) => (
    <ConnectedWindowedModal
        {...props}
        store={context.store}
    />
);

WindowedModalWithStore.contextTypes = {
    store: PropTypes.object
};

export default WindowedModalWithStore;
