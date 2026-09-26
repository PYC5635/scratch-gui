import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import React from 'react';
import SB3Downloader from './sb3-downloader.jsx';
import {openSimpleDialog} from '../reducers/modals';
import ToastNotification from '../components/toast-notification/toast-notification.jsx';

const MenuBarHOC = function (WrappedComponent) {
    class MenuBarContainer extends React.PureComponent {
        constructor (props) {
            super(props);

            bindAll(this, [
                'confirmReadyToReplaceProject',
                'shouldSaveBeforeTransition',
                'showToast'
            ]);
        }
        confirmReadyToReplaceProject (message) {
            let readyToReplaceProject = true;
            if (this.props.projectChanged && !this.props.canCreateNew) {
                readyToReplaceProject = this.props.confirmWithMessage(message);
            }
            return readyToReplaceProject;
        }
        shouldSaveBeforeTransition () {
            return (this.props.canSave && this.props.projectChanged);
        }

        // `position` lets a caller ask for the bottom-right corner (git failures
        // do — see A3); everything else keeps the original top-right toast.
        showToast (message, type = 'info', position = 'top-right') {
            this.props.showToast(message, type, position);
        }

        render () {
            const {
                /* eslint-disable no-unused-vars */
                projectChanged,
                /* eslint-enable no-unused-vars */
                ...props
            } = this.props;
            return (
                <React.Fragment>
                    <SB3Downloader
                        showSaveFilePicker={this.props.showSaveFilePicker}
                    >
                        {(_className, _downloadProject, extended) => (
                            <WrappedComponent
                                confirmReadyToReplaceProject={this.confirmReadyToReplaceProject}
                                shouldSaveBeforeTransition={this.shouldSaveBeforeTransition}
                                handleSaveProject={extended.smartSave}
                                openSimpleDialog={this.props.openSimpleDialog}
                                showToast={this.showToast}
                                {...props}
                            />
                        )}
                    </SB3Downloader>
                    <ToastNotification
                        message={this.props.toastMessage}
                        type={this.props.toastType}
                        position={this.props.toastPosition}
                        visible={this.props.toastVisible}
                        onClose={this.props.hideToast}
                    />
                </React.Fragment>
            );
        }
    }

    MenuBarContainer.propTypes = {
        canCreateNew: PropTypes.bool,
        canSave: PropTypes.bool,
        confirmWithMessage: PropTypes.func,
        projectChanged: PropTypes.bool,
        showSaveFilePicker: PropTypes.func,
        showToast: PropTypes.func.isRequired,
        toastVisible: PropTypes.bool,
        toastMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        toastType: PropTypes.oneOf(['success', 'error', 'info', 'warning']),
        toastPosition: PropTypes.oneOf(['top-right', 'bottom-right'])
    };
    MenuBarContainer.defaultProps = {
        // default to using standard js confirm
        confirmWithMessage: message => (confirm(message)) // eslint-disable-line no-alert
    };
    const mapStateToProps = state => ({
        projectChanged: state.scratchGui.projectChanged,
        toastVisible: state.scratchGui.toast && state.scratchGui.toast.visible,
        toastMessage: state.scratchGui.toast && state.scratchGui.toast.message,
        toastType: state.scratchGui.toast && state.scratchGui.toast.type,
        toastPosition: state.scratchGui.toast && state.scratchGui.toast.position,
        customShortcuts: state.scratchGui.shortcuts.customShortcuts
    });
    const mapDispatchToProps = dispatch => ({
        openSimpleDialog: config => dispatch(openSimpleDialog(config)),
        showToast: (message, type, position) => dispatch({
            type: 'scratch-gui/SHOW_TOAST',
            message,
            toastType: type,
            position
        }),
        hideToast: () => dispatch({
            type: 'scratch-gui/HIDE_TOAST'
        })
    });
    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );
    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(MenuBarContainer);
};

export default MenuBarHOC;
