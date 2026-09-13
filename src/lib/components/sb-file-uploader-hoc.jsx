import bindAll from 'lodash.bindall';
import React from 'react';
import PropTypes from 'prop-types';
import {intlShape, injectIntl} from 'react-intl';
import {connect} from 'react-redux';
import log from '../utils/log';
import sharedMessages from '../constants/shared-messages';
import {setFileHandle, setProjectError} from '../../reducers/tw';
import unpackage from '../unpackager';
import RestorePointAPI from '../api/restore-points';

import {
    LoadingStates,
    getIsLoadingUpload,
    getIsShowingWithoutId,
    onLoadedProject,
    requestProjectUpload,
    getIsShowingProject
} from '../../reducers/project-state';
import {setProjectTitle} from '../../reducers/project-title';
import {
    openLoadingProject,
    closeLoadingProject,
    openInvalidProjectModal
} from '../../reducers/modals';
import {
    closeFileMenu
} from '../../reducers/menus';

/**
 * Higher Order Component to provide behavior for loading local project files into editor.
 * @param {React.Component} WrappedComponent the component to add project file loading functionality to
 * @returns {React.Component} WrappedComponent with project file loading functionality added
 *
 * <SBFileUploaderHOC>
 *     <WrappedComponent />
 * </SBFileUploaderHOC>
 */
const SBFileUploaderHOC = function (WrappedComponent) {
    class SBFileUploaderComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'createFileObjects',
                'getProjectTitleFromFilename',
                'handleFinishedLoadingUpload',
                'handleStartSelectingFileUpload',
                'handleChange',
                'onload',
                'removeFileObjects'
            ]);
            // tw: We have multiple instances of this HOC alive at a time. This flag fixes issues that arise from that.
            this.expectingFileUploadFinish = false;
        }
        componentDidUpdate (prevProps) {
            if (this.props.isLoadingUpload && !prevProps.isLoadingUpload && this.expectingFileUploadFinish) {
                this.handleFinishedLoadingUpload(); // cue step 5 below
            }
        }
        componentWillUnmount () {
            this.removeFileObjects();
        }
        // step 1: this is where the upload process begins
        handleStartSelectingFileUpload () {
            console.log('[SBFileUploader] Step 1: Starting file upload process');
            this.expectingFileUploadFinish = true;
            this.createFileObjects(); // go to step 2
        }
        // step 2: create a FileReader and an <input> element, and issue a
        // pseudo-click to it. That will open the file chooser dialog.
        createFileObjects () {
            console.log('[SBFileUploader] Step 2: Creating file objects');
            // redo step 7, in case it got skipped last time and its objects are
            // still in memory
            this.removeFileObjects();
            // create fileReader
            this.fileReader = new FileReader();
            this.fileReader.onload = this.onload;
            // tw: Use FS API when available
            if (this.props.showOpenFilePicker) {
                console.log('[SBFileUploader] Step 2: Using File System API');
                (async () => {
                    try {
                        const [handle] = await this.props.showOpenFilePicker({
                            multiple: false
                        });
                        const file = await handle.getFile();
                        console.log('[SBFileUploader] Step 2: File selected via FS API:', file.name, file.size);
                        this.handleChange({
                            target: {
                                files: [file],
                                handle: handle
                            }
                        });
                    } catch (err) {
                        // If the user aborted it, that's not an error.
                        if (err && err.name === 'AbortError') {
                            console.log('[SBFileUploader] Step 2: User cancelled file selection');
                            return;
                        }
                        // eslint-disable-next-line no-console
                        console.error('[SBFileUploader] Step 2: Error selecting file:', err);
                    }
                })();
            } else {
                console.log('[SBFileUploader] Step 2: Using fallback input element');
                // create <input> element and add it to DOM
                this.inputElement = document.createElement('input');
                this.inputElement.style = 'display: none;';
                this.inputElement.type = 'file';
                this.inputElement.onchange = this.handleChange; // connects to step 3
                document.body.appendChild(this.inputElement);
                // simulate a click to open file chooser dialog
                this.inputElement.click();
            }
        }
        // step 3: user has picked a file using the file chooser dialog.
        // We don't actually load the file here, we only decide whether to do so.
        handleChange (e) {
            console.log('[SBFileUploader] Step 3: File selected, handling change');
            const {
                intl,
                loadingState,
                projectChanged,
                userOwnsProject
            } = this.props;
            const thisFileInput = e.target;
            if (thisFileInput.files) { // Don't attempt to load if no file was selected
                this.fileToUpload = thisFileInput.files[0];
                console.log('[SBFileUploader] Step 3: Selected file:', this.fileToUpload.name, this.fileToUpload.size, 'bytes');

                // If user owns the project, or user has changed the project,
                // we must confirm with the user that they really intend to
                // replace it. (If they don't own the project and haven't
                // changed it, no need to confirm.)
                let uploadAllowed = true;
                if (userOwnsProject || projectChanged) {
                    uploadAllowed = confirm( // eslint-disable-line no-alert
                        intl.formatMessage(sharedMessages.replaceProjectWarning)
                    );
                    console.log('[SBFileUploader] Step 3: User confirmation:', uploadAllowed);
                }
                if (uploadAllowed) {
                    // Don't update file handle until after confirming replace.
                    const handle = thisFileInput.handle;
                    if (handle) {
                        if (this.fileToUpload.name.endsWith('.sb3')) {
                            this.props.onSetFileHandle(handle);
                        } else {
                            this.props.onSetFileHandle(null);
                        }
                    }

                    // cues step 4
                    console.log('[SBFileUploader] Step 3: Requesting project upload');
                    this.props.requestProjectUpload(loadingState);
                } else {
                    // skips ahead to step 7
                    console.log('[SBFileUploader] Step 3: User cancelled, removing file objects');
                    this.removeFileObjects();
                }
                this.props.closeFileMenu();
            } else {
                console.log('[SBFileUploader] Step 3: No file selected');
            }
        }
        // step 4 is below, in mapDispatchToProps

        // step 5: called from componentDidUpdate when project state shows
        // that project data has finished "uploading" into the browser
        handleFinishedLoadingUpload () {
            console.log('[SBFileUploader] Step 5: Finished loading upload');
            this.expectingFileUploadFinish = false;
            if (this.fileToUpload && this.fileReader) {
                // begin to read data from the file. When finished,
                // cues step 6 using the reader's onload callback
                console.log('[SBFileUploader] Step 5: Reading file as ArrayBuffer:', this.fileToUpload.name);
                this.fileReader.readAsArrayBuffer(this.fileToUpload);
            } else {
                console.log('[SBFileUploader] Step 5: Missing fileToUpload or fileReader, cancelling');
                this.props.cancelFileUpload(this.props.loadingState);
                // skip ahead to step 7
                this.removeFileObjects();
            }
        }
        // used in step 6 below
        getProjectTitleFromFilename (fileInputFilename) {
            if (!fileInputFilename) return '';
            // only parse title with valid scratch project extensions
            // (.sb, .sb2, .sb3, or .html)
            const matches = fileInputFilename.match(/^(.*)\.(?:sb[23]?|html)$/);
            if (!matches) return '';
            return matches[1].substring(0, 100); // truncate project title to max 100 chars
        }
        // step 6: attached as a handler on our FileReader object; called when
        // file upload raw data is available in the reader
        async onload () {
            console.log('[SBFileUploader] Step 6: File reader onload triggered');
            if (this.fileReader) {
                this.props.onLoadingStarted();
                const filename = this.fileToUpload && this.fileToUpload.name;
                let loadingSuccess = false;
                if (this.props.projectChanged) {
                    await RestorePointAPI.createSafetyRestorePoint(this.props.vm, this.props.projectTitle);
                }
                // tw: stop when loading new project
                console.log('[SBFileUploader] Step 6: Quitting VM before loading new project');
                this.props.vm.quit();
                let projectData = this.fileReader.result;
                console.log('[SBFileUploader] Step 6: Project data size:', projectData.byteLength, 'bytes');

                if (filename && filename.endsWith('.html')) {
                    console.log('[SBFileUploader] Step 6: File is HTML, unpackaging...');
                    try {
                        const blob = new Blob([projectData], {type: 'text/html'});
                        const unpackaged = await unpackage(blob);
                        projectData = unpackaged.data;
                        console.log('[SBFileUploader] Step 6: Unpackaging complete, type:', unpackaged.type);
                    } catch (error) {
                        console.error('[SBFileUploader] Step 6: Failed to unpackage HTML file:', error);
                        log.error('Failed to unpackage HTML file:', error);
                        this.props.onLoadingFailed(error);
                        this.props.onLoadingFinished(this.props.loadingState, false);
                        this.removeFileObjects();
                        return;
                    }
                }

                // Snapshot the resolved bytes so the async handler below reads a
                // stable value (projectData may have been reassigned for .html).
                const loadedBytes = projectData;
                this.props.vm.loadProject(loadedBytes, {mwCanTrustProject: true})
                    .then(async () => {
                        console.log('[SBFileUploader] Step 6: VM loadProject succeeded');
                        if (filename) {
                            const uploadedProjectTitle = this.getProjectTitleFromFilename(filename);
                            this.props.onSetProjectTitle(uploadedProjectTitle);
                            console.log('[SBFileUploader] Step 6: Set project title:', uploadedProjectTitle);
                        }
                        this.props.vm.renderer.draw();
                        console.log('[SBFileUploader] Step 6: Renderer draw called');
                        // Restore any git history embedded in the .sb3 (fractch tree + .git),
                        // or clear a stale repo if the loaded project has none.
                        try {
                            const {importRepoFromSb3} = await import('../git/browser-git');
                            await importRepoFromSb3(loadedBytes);
                        } catch (gitError) {
                            log.error('Failed to restore embedded git history:', gitError);
                        }
                        loadingSuccess = true;
                    })
                    .catch(error => {
                        console.error('[SBFileUploader] Step 6: VM loadProject failed:', error);
                        log.error(error);
                        this.props.onLoadingFailed(error);
                    })
                    .then(() => {
                        console.log('[SBFileUploader] Step 6: Loading finished, success:', loadingSuccess);
                        this.props.onLoadingFinished(this.props.loadingState, loadingSuccess);
                        // go back to step 7: whether project loading succeeded
                        // or failed, reset file objects
                        this.removeFileObjects();
                    });
            } else {
                console.log('[SBFileUploader] Step 6: fileReader is null, skipping');
            }
        }
        // step 7: remove the <input> element from the DOM and clear reader and
        // fileToUpload reference, so those objects can be garbage collected
        removeFileObjects () {
            if (this.inputElement) {
                try {
                    // 某些 Android WebView 对 value 赋值 null 会抛 InvalidStateError，
                    // 导致卸载流程中断。置为空字符串即可清空已选文件，且绝对安全。
                    if (this.inputElement.value) {
                        this.inputElement.value = '';
                    }
                } catch (e) {
                    // 忽略：即使 value 赋值失败，下面也会从 DOM 移除该元素
                }
                if (this.inputElement.parentNode) {
                    this.inputElement.parentNode.removeChild(this.inputElement);
                }
            }
            this.inputElement = null;
            this.fileReader = null;
            this.fileToUpload = null;
        }
        render () {
            const {
                /* eslint-disable no-unused-vars */
                cancelFileUpload,
                closeFileMenu: closeFileMenuProp,
                isLoadingUpload,
                isShowingWithoutId,
                loadingState,
                onLoadingFailed,
                onLoadingFinished,
                onLoadingStarted,
                onSetFileHandle,
                onSetProjectTitle,
                projectChanged,
                projectTitle,
                requestProjectUpload: requestProjectUploadProp,
                userOwnsProject,
                /* eslint-enable no-unused-vars */
                ...componentProps
            } = this.props;
            return (
                <React.Fragment>
                    <WrappedComponent
                        onStartSelectingFileUpload={this.handleStartSelectingFileUpload}
                        {...componentProps}
                    />
                </React.Fragment>
            );
        }
    }

    SBFileUploaderComponent.propTypes = {
        canSave: PropTypes.bool,
        cancelFileUpload: PropTypes.func,
        closeFileMenu: PropTypes.func,
        intl: intlShape.isRequired,
        isLoadingUpload: PropTypes.bool,
        isShowingProject: PropTypes.bool,
        isShowingWithoutId: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        onLoadingFailed: PropTypes.func,
        onLoadingFinished: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onSetProjectTitle: PropTypes.func,
        projectChanged: PropTypes.bool,
        projectTitle: PropTypes.string,
        requestProjectUpload: PropTypes.func,
        showOpenFilePicker: PropTypes.func,
        userOwnsProject: PropTypes.bool,
        vm: PropTypes.shape({
            loadProject: PropTypes.func,
            quit: PropTypes.func,
            renderer: PropTypes.shape({
                draw: PropTypes.func
            })
        }),
        onSetFileHandle: PropTypes.func
    };
    SBFileUploaderComponent.defaultProps = {
        showOpenFilePicker: typeof showOpenFilePicker === 'function' && !navigator.userAgent.includes('Android') ?
            window.showOpenFilePicker.bind(window) :
            null
    };
    const mapStateToProps = (state, ownProps) => {
        const loadingState = state.scratchGui.projectState.loadingState;
        const user = state.session && state.session.session && state.session.session.user;
        return {
            isLoadingUpload: getIsLoadingUpload(loadingState),
            isShowingProject: getIsShowingProject(loadingState),
            isShowingWithoutId: getIsShowingWithoutId(loadingState),
            loadingState: loadingState,
            projectChanged: state.scratchGui.projectChanged,
            projectTitle: state.scratchGui.projectTitle,
            userOwnsProject: ownProps.authorUsername && user &&
                (ownProps.authorUsername === user.username),
            vm: state.scratchGui.vm
        };
    };
    const mapDispatchToProps = (dispatch, ownProps) => ({
        cancelFileUpload: loadingState => dispatch(onLoadedProject(loadingState, false, false)),
        closeFileMenu: () => dispatch(closeFileMenu()),
        onLoadingFailed: error => {
            dispatch(setProjectError(error));
            dispatch(openInvalidProjectModal());
        },
        // transition project state from loading to regular, and close
        // loading screen and file menu
        onLoadingFinished: (loadingState, success) => {
            dispatch(onLoadedProject(loadingState, ownProps.canSave, success));
            dispatch(closeLoadingProject());
            dispatch(closeFileMenu());
        },
        // show project loading screen
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onSetProjectTitle: title => dispatch(setProjectTitle(title)),
        // step 4: transition the project state so we're ready to handle the new
        // project data. When this is done, the project state transition will be
        // noticed by componentDidUpdate()
        requestProjectUpload: loadingState => dispatch(requestProjectUpload(loadingState)),
        onSetFileHandle: fileHandle => dispatch(setFileHandle(fileHandle))
    });
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return injectIntl(connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(SBFileUploaderComponent));
};

export {
    SBFileUploaderHOC as default
};
