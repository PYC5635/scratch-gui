import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import VM from 'scratch-vm';
import AudioEngine from 'scratch-audio';

import {setProjectUnchanged} from '../../reducers/project-changed';
import {
    LoadingStates,
    getIsLoadingWithId,
    onLoadedProject,
    projectError
} from '../../reducers/project-state';
import log from '../utils/log';

/**
 * List of fonts that could be used by security prompts.
 */
const SECURITY_CRITICAL_FONTS = [
    'Helvetica Neue',
    'Helvetica',
    'Arial'
];

/*
 * Higher Order Component to manage events emitted by the VM
 * @param {React.Component} WrappedComponent component to manage VM events for
 * @returns {React.Component} connected component with vm events bound to redux
 */
const vmManagerHOC = function (WrappedComponent) {
    class VMManager extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'loadProject'
            ]);
            this._loadTimeout = null;
            this._drawTimeout = null;
            this._loadingPromise = null;
        }
        componentDidMount () {
            if (!this.props.vm.initialized) {
                window.vm = this.props.vm;

                try {
                    this.audioEngine = new AudioEngine();
                    this.props.vm.attachAudioEngine(this.audioEngine);
                } catch (e) {
                    log.error('could not create scratch-audio', e);
                }
                for (const font of SECURITY_CRITICAL_FONTS) {
                    this.props.vm.runtime.fontManager.restrictFont(font);
                }
                this.props.vm.initialized = true;
                this.props.vm.setLocale(this.props.locale, this.props.messages);
            }
            if (!this.props.isPlayerOnly && !this.props.isStarted) {
                this.props.vm.start();
            }
        }
        componentDidUpdate (prevProps) {
            // if project is in loading state, AND fonts are loaded,
            // and they weren't both that way until now... load project!
            if (this.props.isLoadingWithId && this.props.fontsLoaded &&
                (!prevProps.isLoadingWithId || !prevProps.fontsLoaded)) {
                this.loadProject();
            }
            // Start the VM if entering editor mode with an unstarted vm
            if (!this.props.isPlayerOnly && !this.props.isStarted) {
                this.props.vm.start();
            }
        }

        componentWillUnmount () {
            // Cancel pending post-load callbacks so nothing dispatches or
            // touches the renderer after the GUI has been torn down.
            if (this._loadTimeout) {
                clearTimeout(this._loadTimeout);
                this._loadTimeout = null;
            }
            if (this._drawTimeout) {
                clearTimeout(this._drawTimeout);
                this._drawTimeout = null;
            }
            // Mark any in-flight load as cancelled so its .then() callbacks
            // do not dispatch to an unmounted component.
            this._loadingPromise = null;
        }

        loadProject () {
            // Guard against concurrent loads: if a previous load is still in
            // flight, quit the VM first (which cancels its work) and then let
            // the new load proceed. The old promise is discarded so its
            // callbacks won't fire on a stale VM state.
            if (this._loadingPromise) {
                if (process.env.DEBUG) {
                    console.warn('[VM Manager] New project load requested while previous load is still in progress; cancelling previous load');
                }
                this.props.vm.quit();
            }

            // tw: stop when loading new project
            if (process.env.DEBUG) {
                // eslint-disable-next-line no-console
                console.log('[VM Manager] Quitting VM before loading project');
                // eslint-disable-next-line no-console
                console.log('[VM Manager] Loading project data, size:',
                    this.props.projectData instanceof ArrayBuffer ? this.props.projectData.byteLength : 'unknown');
            }
            this.props.vm.quit();
            const promise = this.props.vm.loadProject(this.props.projectData)
                .then(() => {
                    // If a newer load has started (or the component unmounted),
                    // discard this result — the VM is already in a different state.
                    if (this._loadingPromise !== promise) {
                        if (process.env.DEBUG) {
                            console.warn('[VM Manager] Discarding stale project load result');
                        }
                        return;
                    }
                    if (process.env.DEBUG) {
                        // eslint-disable-next-line no-console
                        console.log('[VM Manager] Project loaded successfully');
                    }
                    this.props.onLoadedProject(this.props.loadingState, this.props.canSave);
                    // Wrap in a setTimeout because skin loading in
                    // the renderer can be async.
                    this._loadTimeout = setTimeout(() => {
                        if (this._loadingPromise !== promise) return;
                        if (process.env.DEBUG) {
                            // eslint-disable-next-line no-console
                            console.log('[VM Manager] Setting project as unchanged');
                        }
                        this.props.onSetProjectUnchanged();
                        this._loadTimeout = null;
                    });

                    // If the vm is not running, call draw on the renderer manually
                    // This draws the state of the loaded project with no blocks running
                    // which closely matches the 2.0 behavior, except for monitors–
                    // 2.0 runs monitors and shows updates (e.g. timer monitor)
                    // before the VM starts running other hat blocks.
                    if (!this.props.isStarted) {
                        // Wrap in a setTimeout because skin loading in
                        // the renderer can be async.
                        this._drawTimeout = setTimeout(() => {
                            if (this._loadingPromise !== promise) return;
                            this.props.vm.renderer.draw();
                            this._drawTimeout = null;
                        });
                    }
                    this._loadingPromise = null;
                })
                .catch(e => {
                    if (this._loadingPromise !== promise) return;
                    // eslint-disable-next-line no-console
                    console.error('[VM Manager] Project loading failed:', e);
                    this.props.onError(e);
                    this._loadingPromise = null;
                });
            this._loadingPromise = promise;
            return promise;
        }
        render () {
            const {
                /* eslint-disable no-unused-vars */
                fontsLoaded,
                loadingState,
                locale,
                messages,
                isStarted,
                onError: onErrorProp,
                onLoadedProject: onLoadedProjectProp,
                onSetProjectUnchanged,
                projectData,
                /* eslint-enable no-unused-vars */
                isLoadingWithId: isLoadingWithIdProp,
                vm,
                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    isLoading={isLoadingWithIdProp}
                    vm={vm}
                    {...componentProps}
                />
            );
        }
    }

    VMManager.propTypes = {
        canSave: PropTypes.bool,
        cloudHost: PropTypes.string,
        fontsLoaded: PropTypes.bool,
        isLoadingWithId: PropTypes.bool,
        isPlayerOnly: PropTypes.bool,
        isStarted: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        locale: PropTypes.string,
        messages: PropTypes.objectOf(PropTypes.string),
        onError: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onSetProjectUnchanged: PropTypes.func,
        projectData: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        username: PropTypes.string,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            fontsLoaded: state.scratchGui.fontsLoaded,
            isLoadingWithId: getIsLoadingWithId(loadingState),
            locale: state.locales.locale,
            messages: state.locales.messages,
            projectData: state.scratchGui.projectState.projectData,
            projectId: state.scratchGui.projectState.projectId,
            loadingState: loadingState,
            isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
            isStarted: state.scratchGui.vmStatus.started
        };
    };

    const mapDispatchToProps = dispatch => ({
        onError: error => dispatch(projectError(error)),
        onLoadedProject: (loadingState, canSave) =>
            dispatch(onLoadedProject(loadingState, canSave, true)),
        onSetProjectUnchanged: () => dispatch(setProjectUnchanged())
    });

    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );

    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(VMManager);
};

export default vmManagerHOC;
