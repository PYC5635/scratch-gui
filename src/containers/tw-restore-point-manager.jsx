import React from 'react';
import {connect} from 'react-redux';
import {intlShape, injectIntl, defineMessages} from 'react-intl';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {showAlertWithTimeout, showStandardAlert} from '../reducers/alerts';
import {closeLoadingProject, closeRestorePointModal, openLoadingProject} from '../reducers/modals';
import {LoadingStates, getIsShowingProject, onLoadedProject, requestProjectUpload} from '../reducers/project-state';
import {setFileHandle} from '../reducers/tw';
import TWRestorePointModal from '../components/tw-restore-point-modal/restore-point-modal.jsx';
import RestorePointAPI from '../lib/api/restore-points';
import log from '../lib/utils/log';
import downloadBlob from '../lib/utils/download-blob.js';

/* eslint-disable no-alert */

const SAVE_DELAY = 250;
const MINIMUM_SAVE_TIME = 1000;
const MAX_SAVE_DURATION_BEFORE_COOLDOWN = 2000; // If a save takes > 2s, apply cooldown

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const messages = defineMessages({
    confirmLoad: {
        defaultMessage: 'You have unsaved changes. Replace existing project?',
        description: 'Confirmation that appears when loading a restore point to confirm overwriting unsaved changes.',
        id: 'tw.restorePoints.confirmLoad'
    },
    confirmDelete: {
        defaultMessage: 'Are you sure you want to delete "{projectTitle}"? This cannot be undone.',
        description: 'Confirmation that appears when deleting a restore poinnt',
        id: 'tw.restorePoints.confirmDelete'
    },
    confirmDeleteAll: {
        defaultMessage: 'Are you sure you want to delete ALL restore points? This cannot be undone.',
        description: 'Confirmation that appears when deleting ALL restore points.',
        id: 'tw.restorePoints.confirmDeleteAll'
    },
    loadError: {
        defaultMessage: 'Error loading restore point: {error}',
        description: 'Error message when a restore point could not be loaded',
        id: 'tw.restorePoints.error'
    },
    exportError: {
        defaultMessage: 'Error exporting restore point: {error}',
        description: 'Error message when a restore point could not be exported',
        id: 'tw.restorePoints.exportError'
    }
});

class TWRestorePointManager extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleProjectChanged',
            'handleClickCreate',
            'handleClickDelete',
            'handleClickDeleteAll',
            'handleClickRefresh',
            'handleChangeInterval',
            'handleClickExport',
            'handleClickLoad',
            'isExportingRestorePoint',
            'showConfirmDialog',
            'handleConfirmDialog',
            'handleCancelDialog'
        ]);
        this.state = {
            loading: true,
            totalSize: 0,
            restorePoints: [],
            error: null,
            interval: RestorePointAPI.readInterval(),
            exportingRestorePoints: [],
            // 自定义确认对话框状态：{message, onConfirm}
            // 替代原生 confirm()，样式与扩展管理弹窗保持一致
            confirmDialog: null
        };
        this.timeout = null;
        this._lastSaveDuration = 0;
        this._saveCooldownUntil = 0;
    }

    componentDidMount () {
        // This helps reduce problems when people constantly enter and leave the editor which
        // causes this component to re-mount. Still not perfect though, ideally we would
        // compensate for time already passed.
        if (this.props.projectChanged && this.props.hasEverEnteredEditor) {
            this.queueRestorePoint();
        }

        // 防御：组件挂载时若还原点窗口已经处于打开状态，立即刷新一次，
        // 确保首次打开窗口就显示最新的还原点列表
        if (this.props.isModalVisible) {
            this.refreshState();
        }

        RestorePointAPI.deleteLegacyRestorePoint();
        this.props.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
        this.props.vm.on('TRIGGER_MANUAL_RESTORE_POINT', this.handleClickCreate);
    }

    UNSAFE_componentWillReceiveProps (nextProps) {
        if (nextProps.isModalVisible && !this.props.isModalVisible) {
            this.refreshState();
        } else if (!nextProps.isModalVisible && this.props.isModalVisible) {
            this.setState({
                restorePoints: []
            });
        }
    }

    componentWillUnmount () {
        this.cancelQueuedRestorePoint();
        this.props.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
        this.props.vm.off('TRIGGER_MANUAL_RESTORE_POINT', this.handleClickCreate);
    }

    handleProjectChanged () {
        if (this.props.hasEverEnteredEditor && !this.timeout) {
            this.queueRestorePoint();
        }
    }

    handleClickCreate () {
        this.createRestorePoint(RestorePointAPI.TYPE_MANUAL)
            .catch(error => {
                this.handleModalError(error);
            });
    }

    handleClickRefresh () {
        this.refreshState();
    }

    handleClickDelete (id) {
        const projectTitle = this.state.restorePoints.find(i => i.id === id).title;
        this.showConfirmDialog(
            this.props.intl.formatMessage(messages.confirmDelete, {projectTitle}),
            () => {
                this.setState({
                    loading: true
                });
                RestorePointAPI.deleteRestorePoint(id)
                    .then(() => {
                        this.refreshState();
                    })
                    .catch(error => {
                        this.handleModalError(error);
                    });
            }
        );
    }

    handleClickDeleteAll () {
        this.showConfirmDialog(
            this.props.intl.formatMessage(messages.confirmDeleteAll),
            () => {
                this.setState({
                    loading: true
                });
                RestorePointAPI.deleteAllRestorePoints()
                    .then(() => {
                        this.refreshState();
                    })
                    .catch(error => {
                        this.handleModalError(error);
                    });
            }
        );
    }

    // 加载还原点：若项目有未保存修改，先弹出确认对话框
    handleClickLoad (id) {
        if (!this.props.isShowingProject) {
            // Loading a project now will break the state machine
            return;
        }
        if (this.props.projectChanged) {
            this.showConfirmDialog(
                this.props.intl.formatMessage(messages.confirmLoad),
                () => this.loadRestorePoint(id)
            );
            return;
        }
        this.loadRestorePoint(id);
    }

    loadRestorePoint (id) {
        this.props.onCloseModal();
        this.props.onStartLoadingRestorePoint(this.props.loadingState);

        const backup = this.props.projectChanged ?
            RestorePointAPI.createSafetyRestorePoint(this.props.vm, this.props.projectTitle) :
            Promise.resolve();
        backup
            .then(() => RestorePointAPI.loadRestorePoint(this.props.vm, id))
            .then(() => {
                this.props.onFinishLoadingRestorePoint(true, this.props.loadingState);
                setTimeout(() => {
                    this.props.vm.renderer.draw();
                });
            })
            .catch(error => {
                log.error(error);
                alert(this.props.intl.formatMessage(messages.loadError, {
                    error
                }));
                this.props.onFinishLoadingRestorePoint(false, this.props.loadingState);
            });
    }

    handleClickExport (id) {
        if (this.isExportingRestorePoint(id)) {
            return;
        }

        this.setState(oldState => ({
            exportingRestorePoints: [...oldState.exportingRestorePoints, id]
        }));

        const removeFromExportingList = () => {
            this.setState(oldState => ({
                exportingRestorePoints: oldState.exportingRestorePoints.filter(i => i !== id)
            }));
        };

        RestorePointAPI.exportRestorePoint(id)
            .then(result => {
                // The project title may be blank (new project that was never
                // named), which would produce a download named ".sb3". Fall back
                // to a default name so the exported file always has a useful
                // "作品名.sb3" style filename.
                const title = (result.title || '').trim();
                downloadBlob(`${title || 'project'}.sb3`, result.blob);
                removeFromExportingList();
            })
            .catch(error => {
                log.error(error);
                alert(this.props.intl.formatMessage(messages.exportError, {
                    error
                }));
                removeFromExportingList();
            });
    }

    isExportingRestorePoint (id) {
        return this.state.exportingRestorePoints.includes(id);
    }

    handleChangeInterval (e) {
        const interval = +e.target.value;
        RestorePointAPI.setInterval(interval);
        this.setState({
            interval
        }, () => {
            if (this.timeout) {
                this.cancelQueuedRestorePoint();
                this.queueRestorePoint();
            }
        });
    }

    queueRestorePoint () {
        if (this.timeout || this.state.interval < 0) {
            return;
        }
        // If the last save was slow (large project), apply a cooldown so the
        // editor doesn't stutter from rapid consecutive saves.
        const now = Date.now();
        if (now < this._saveCooldownUntil) {
            return;
        }
        this.timeout = setTimeout(() => {
            this.createRestorePoint(RestorePointAPI.TYPE_AUTOMATIC).then(() => {
                this.timeout = null;
            });
        }, this.state.interval);
    }

    cancelQueuedRestorePoint () {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    createRestorePoint (type) {
        if (this.props.isModalVisible) {
            this.setState({
                loading: true
            });
        }

        this.props.onStartCreatingRestorePoint();
        const startedAt = Date.now();
        return Promise.all([
            // Wait a little bit before saving so UI can update before saving, which can cause stutter
            sleep(SAVE_DELAY)
                .then(() => RestorePointAPI.createRestorePoint(this.props.vm, this.props.projectTitle, type))
                .then(() => RestorePointAPI.removeExtraneousRestorePoints()),

            // Force saves to not be instant so people can see that we're making a restore point
            // It also makes refreshes less likely to cause accidental clicks in the modal
            sleep(MINIMUM_SAVE_TIME)
        ])
            .then(() => {
                const elapsed = Date.now() - startedAt;
                this._lastSaveDuration = elapsed;
                // If the last save took longer than the threshold (large
                // project), apply a cooldown equal to the save duration so
                // the editor doesn't stutter from rapid consecutive saves.
                if (elapsed > MAX_SAVE_DURATION_BEFORE_COOLDOWN) {
                    this._saveCooldownUntil = Date.now() + elapsed;
                }
                this.props.onFinishCreatingRestorePoint();
                if (this.props.isModalVisible) {
                    this.refreshState();
                }
            })
            .catch(error => {
                log.error(error);
                this.props.onErrorCreatingRestorePoint();
                if (this.props.isModalVisible) {
                    this.refreshState();
                }
            });
    }

    refreshState () {
        this.setState({
            loading: true,
            error: null,
            restorePoints: []
        });
        RestorePointAPI.getAllRestorePoints()
            .then(data => {
                this.setState({
                    loading: false,
                    totalSize: data.totalSize,
                    restorePoints: data.restorePoints
                });
            })
            .catch(error => {
                this.handleModalError(error);
            });
    }

    handleModalError (error) {
        log.error('Restore point error', error);
        this.setState({
            error: `${error}`,
            loading: false
        });
    }

    // 打开自定义确认对话框（替代原生 confirm()）
    showConfirmDialog (message, onConfirm) {
        this.setState({
            confirmDialog: {
                message,
                onConfirm
            }
        });
    }

    handleConfirmDialog () {
        const dialog = this.state.confirmDialog;
        this.setState({
            confirmDialog: null
        }, () => {
            if (dialog && typeof dialog.onConfirm === 'function') {
                dialog.onConfirm();
            }
        });
    }

    handleCancelDialog () {
        this.setState({
            confirmDialog: null
        });
    }

    render () {
        if (this.props.isModalVisible) {
            return (
                <TWRestorePointModal
                    onClose={this.props.onCloseModal}
                    onClickCreate={this.handleClickCreate}
                    onClickDelete={this.handleClickDelete}
                    onClickDeleteAll={this.handleClickDeleteAll}
                    onClickExport={this.handleClickExport}
                    onClickLoad={this.handleClickLoad}
                    onClickRefresh={this.handleClickRefresh}
                    interval={this.state.interval}
                    onChangeInterval={this.handleChangeInterval}
                    isExporting={this.isExportingRestorePoint}
                    isLoading={this.state.loading}
                    totalSize={this.state.totalSize}
                    restorePoints={this.state.restorePoints}
                    error={this.state.error}
                    confirmDialog={this.state.confirmDialog}
                    onConfirmDialog={this.handleConfirmDialog}
                    onCancelDialog={this.handleCancelDialog}
                />
            );
        }
        return null;
    }
}

TWRestorePointManager.propTypes = {
    intl: intlShape,
    projectChanged: PropTypes.bool.isRequired,
    projectTitle: PropTypes.string.isRequired,
    onStartCreatingRestorePoint: PropTypes.func.isRequired,
    onFinishCreatingRestorePoint: PropTypes.func.isRequired,
    onErrorCreatingRestorePoint: PropTypes.func.isRequired,
    onStartLoadingRestorePoint: PropTypes.func.isRequired,
    onFinishLoadingRestorePoint: PropTypes.func.isRequired,
    onCloseModal: PropTypes.func.isRequired,
    loadingState: PropTypes.oneOf(LoadingStates).isRequired,
    isShowingProject: PropTypes.bool.isRequired,
    isModalVisible: PropTypes.bool.isRequired,
    hasEverEnteredEditor: PropTypes.bool.isRequired,
    vm: PropTypes.shape({
        on: PropTypes.func.isRequired,
        off: PropTypes.func.isRequired,
        loadProject: PropTypes.func.isRequired,
        stop: PropTypes.func.isRequired,
        renderer: PropTypes.shape({
            draw: PropTypes.func.isRequired
        })
    }).isRequired
};

const mapStateToProps = state => ({
    projectChanged: state.scratchGui.projectChanged,
    projectTitle: state.scratchGui.projectTitle,
    loadingState: state.scratchGui.projectState.loadingState,
    isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
    isModalVisible: state.scratchGui.modals.restorePointModal,
    hasEverEnteredEditor: state.scratchGui.mode.hasEverEnteredEditor,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onStartCreatingRestorePoint: () => dispatch(showStandardAlert('twCreatingRestorePoint')),
    onFinishCreatingRestorePoint: () => showAlertWithTimeout(dispatch, 'twRestorePointSuccess'),
    onErrorCreatingRestorePoint: () => showAlertWithTimeout(dispatch, 'twRestorePointError'),
    onStartLoadingRestorePoint: loadingState => {
        dispatch(openLoadingProject());
        dispatch(requestProjectUpload(loadingState));
    },
    onFinishLoadingRestorePoint: (success, loadingState) => {
        dispatch(onLoadedProject(loadingState, false, success));
        dispatch(closeLoadingProject());
        dispatch(setFileHandle(null));
    },
    onCloseModal: () => dispatch(closeRestorePointModal())
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(TWRestorePointManager));
