import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import {
    CircleAlert,
    Download,
    Flag,
    Mic,
    Settings2,
    Square,
    Timer,
    Video,
    Volume2,
    X
} from 'lucide-react';

import AddonWindow from '../../addons/window-system/window.jsx';
import downloadBlob from '../../addons/libraries/common/cs/download-blob.js';
import styles from './media-recorder.css';

const MIME_TYPES = [
    'video/webm; codecs=vp9',
    'video/webm',
    'video/mp4'
];

const messages = defineMessages({
    title: {
        id: 'mw.mediaRecorder.title',
        defaultMessage: 'Project Video Recorder'
    },
    captureStage: {
        id: 'mw.mediaRecorder.captureStage',
        defaultMessage: 'Capture the stage'
    },
    captureStageDescription: {
        id: 'mw.mediaRecorder.captureStageDescription',
        defaultMessage: 'Save the stage as a .{extension} video. Variable and list monitors are not included.'
    },
    timing: {
        id: 'mw.mediaRecorder.timing',
        defaultMessage: 'Timing'
    },
    duration: {
        id: 'mw.mediaRecorder.duration',
        defaultMessage: 'Duration'
    },
    startDelay: {
        id: 'mw.mediaRecorder.startDelay',
        defaultMessage: 'Start delay'
    },
    seconds: {
        id: 'mw.mediaRecorder.seconds',
        defaultMessage: 'seconds'
    },
    captureOptions: {
        id: 'mw.mediaRecorder.captureOptions',
        defaultMessage: 'Capture options'
    },
    includeProjectAudio: {
        id: 'mw.mediaRecorder.includeProjectAudio',
        defaultMessage: 'Include project audio'
    },
    includeMicrophoneAudio: {
        id: 'mw.mediaRecorder.includeMicrophoneAudio',
        defaultMessage: 'Include microphone audio'
    },
    waitForFlag: {
        id: 'mw.mediaRecorder.waitForFlag',
        defaultMessage: 'Wait for the green flag'
    },
    stopWhenProjectStops: {
        id: 'mw.mediaRecorder.stopWhenProjectStops',
        defaultMessage: 'Stop when the project stops'
    },
    cancel: {
        id: 'mw.mediaRecorder.cancel',
        defaultMessage: 'Cancel'
    },
    startRecording: {
        id: 'mw.mediaRecorder.startRecording',
        defaultMessage: 'Start recording'
    },
    waitingForFlag: {
        id: 'mw.mediaRecorder.waitingForFlag',
        defaultMessage: 'Waiting for the green flag'
    },
    startingShortly: {
        id: 'mw.mediaRecorder.startingShortly',
        defaultMessage: 'Starting shortly'
    },
    recordingStage: {
        id: 'mw.mediaRecorder.recordingStage',
        defaultMessage: 'Recording the stage'
    },
    waitingDescription: {
        id: 'mw.mediaRecorder.waitingDescription',
        defaultMessage: 'Recording will begin when the project starts.'
    },
    startingIn: {
        id: 'mw.mediaRecorder.startingIn',
        defaultMessage: 'Starting in {countdown} seconds.'
    },
    keepOpenDescription: {
        id: 'mw.mediaRecorder.keepOpenDescription',
        defaultMessage: 'Keep this window open or return to the editor while the capture runs.'
    },
    elapsed: {
        id: 'mw.mediaRecorder.elapsed',
        defaultMessage: 'Elapsed'
    },
    captured: {
        id: 'mw.mediaRecorder.captured',
        defaultMessage: 'Captured'
    },
    discard: {
        id: 'mw.mediaRecorder.discard',
        defaultMessage: 'Discard'
    },
    stopAndSave: {
        id: 'mw.mediaRecorder.stopAndSave',
        defaultMessage: 'Stop and save'
    },
    recordingStatus: {
        id: 'mw.mediaRecorder.recordingStatus',
        defaultMessage: 'Recording status'
    },
    recordProjectVideo: {
        id: 'mw.mediaRecorder.recordProjectVideo',
        defaultMessage: 'Record project video'
    },
    recording: {
        id: 'mw.mediaRecorder.recording',
        defaultMessage: 'Recording'
    },
    record: {
        id: 'mw.mediaRecorder.record',
        defaultMessage: 'Record'
    },
    errorUnsupportedFormat: {
        id: 'mw.mediaRecorder.errorUnsupportedFormat',
        defaultMessage: 'This browser cannot encode a supported video format.'
    },
    errorMicFailed: {
        id: 'mw.mediaRecorder.errorMicFailed',
        defaultMessage: 'Microphone access failed.'
    },
    errorMicUnavailable: {
        id: 'mw.mediaRecorder.errorMicUnavailable',
        defaultMessage: 'Microphone access was unavailable. Recording will continue without it.'
    },
    errorNoVideoTrack: {
        id: 'mw.mediaRecorder.errorNoVideoTrack',
        defaultMessage: 'The stage could not provide a video track.'
    },
    errorRecordingFailed: {
        id: 'mw.mediaRecorder.errorRecordingFailed',
        defaultMessage: 'Recording failed.'
    },
    errorRecordingStart: {
        id: 'mw.mediaRecorder.errorRecordingStart',
        defaultMessage: 'Recording could not start.'
    }
});

const formatBytes = bytes => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

class MediaRecorderButton extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            open: false,
            phase: 'options',
            duration: 30,
            delay: 0,
            projectAudio: true,
            microphone: false,
            startOnFlag: true,
            stopOnStop: true,
            elapsed: 0,
            bytes: 0,
            countdown: 0,
            error: ''
        };
        this.recorder = null;
        this.chunks = [];
        this.saveOnStop = true;
        this.durationTimer = null;
        this.statusTimer = null;
        this.delayTimer = null;
        this.flagListener = null;
        this.stopListener = null;
        this.micStream = null;
        this.captureStream = null;
        this.mixContext = null;
        this.projectAudioDestination = null;
        this.startedAt = 0;
        this.unmounted = false;
    }

    componentWillUnmount () {
        this.unmounted = true;
        this.cancelRecording();
    }

    getMimeType () {
        return MIME_TYPES.find(type => window.MediaRecorder.isTypeSupported(type)) || '';
    }

    getExtension () {
        return this.getMimeType().startsWith('video/mp4') ? 'mp4' : 'webm';
    }

    clearTimers () {
        clearTimeout(this.durationTimer);
        clearInterval(this.statusTimer);
        clearInterval(this.delayTimer);
        this.durationTimer = null;
        this.statusTimer = null;
        this.delayTimer = null;
    }

    removeRuntimeListeners () {
        const runtime = this.props.vm.runtime;
        if (this.flagListener) runtime.off('PROJECT_START', this.flagListener);
        if (this.stopListener) runtime.off('PROJECT_STOP_ALL', this.stopListener);
        this.flagListener = null;
        this.stopListener = null;
    }

    releaseStreams () {
        if (this.captureStream) {
            for (const track of this.captureStream.getTracks()) track.stop();
        }
        if (this.micStream) {
            for (const track of this.micStream.getTracks()) track.stop();
        }
        if (this.projectAudioDestination) {
            try {
                this.props.vm.runtime.audioEngine.inputNode.disconnect(this.projectAudioDestination);
            } catch (_) {
                // ignore
            }
            for (const track of this.projectAudioDestination.stream.getTracks()) track.stop();
        }
        if (this.mixContext) this.mixContext.close();
        this.captureStream = null;
        this.micStream = null;
        this.mixContext = null;
        this.projectAudioDestination = null;
    }

    cleanupCapture () {
        this.clearTimers();
        this.removeRuntimeListeners();
        this.releaseStreams();
        this.recorder = null;
        this.chunks = [];
    }

    cancelRecording () {
        this.saveOnStop = false;
        if (this.recorder && this.recorder.state !== 'inactive') {
            this.recorder.stop();
        } else {
            this.cleanupCapture();
        }
    }

    handleOpen = () => {
        this.setState({open: true});
    };

    handleClose = () => {
        this.setState({open: false});
    };

    handleNumberChange = event => {
        const field = event.currentTarget.dataset.field;
        const limits = field === 'duration' ? [1, 600] : [0, 600];
        const value = Math.min(limits[1], Math.max(limits[0], Number(event.currentTarget.value) || 0));
        this.setState({[field]: value});
    };

    handleToggle = event => {
        const field = event.currentTarget.dataset.field;
        this.setState({[field]: event.currentTarget.checked});
    };

    handleStart = async () => {
        if (!this.getMimeType()) {
            this.setState({error: this.props.intl.formatMessage(messages.errorUnsupportedFormat)});
            return;
        }
        this.setState({error: '', elapsed: 0, bytes: 0});
        if (this.state.microphone) {
            try {
                this.micStream = await navigator.mediaDevices.getUserMedia({audio: true});
            } catch (error) {
                const unavailable = error.name === 'NotAllowedError' || error.name === 'NotFoundError';
                if (!unavailable) {
                    this.setState({error: error.message || this.props.intl.formatMessage(messages.errorMicFailed)});
                    return;
                }
                this.setState({microphone: false,
                    error: this.props.intl.formatMessage(messages.errorMicUnavailable)});
            }
        }
        if (this.unmounted) {
            this.releaseStreams();
            return;
        }
        if (this.state.startOnFlag) {
            this.setState({phase: 'waiting'});
            this.flagListener = () => {
                this.flagListener = null;
                this.beginDelay();
            };
            this.props.vm.runtime.once('PROJECT_START', this.flagListener);
        } else {
            this.beginDelay();
        }
    };

    beginDelay () {
        if (this.state.delay <= 0) {
            this.beginCapture();
            return;
        }
        const endsAt = Date.now() + (this.state.delay * 1000);
        const update = () => {
            const countdown = Math.max(0, (endsAt - Date.now()) / 1000);
            this.setState({phase: 'delaying', countdown});
            if (countdown <= 0) {
                clearInterval(this.delayTimer);
                this.delayTimer = null;
                this.beginCapture();
            }
        };
        update();
        this.delayTimer = setInterval(update, 100);
    }

    beginCapture () {
        try {
            const runtime = this.props.vm.runtime;
            this.captureStream = new MediaStream();
            const stageStream = runtime.renderer.canvas.captureStream();
            const videoTrack = stageStream.getVideoTracks()[0];
            if (!videoTrack) throw new Error(this.props.intl.formatMessage(messages.errorNoVideoTrack));
            this.captureStream.addTrack(videoTrack);

            if (this.state.projectAudio || this.micStream) {
                this.mixContext = new AudioContext();
                const mix = this.mixContext.createMediaStreamDestination();
                if (this.state.projectAudio) {
                    this.projectAudioDestination = runtime.audioEngine.audioContext.createMediaStreamDestination();
                    runtime.audioEngine.inputNode.connect(this.projectAudioDestination);
                    this.mixContext.createMediaStreamSource(this.projectAudioDestination.stream).connect(mix);
                }
                if (this.micStream) this.mixContext.createMediaStreamSource(this.micStream).connect(mix);
                const audioTrack = mix.stream.getAudioTracks()[0];
                if (audioTrack) this.captureStream.addTrack(audioTrack);
            }

            this.chunks = [];
            this.saveOnStop = true;
            this.recorder = new window.MediaRecorder(this.captureStream, {mimeType: this.getMimeType()});
            this.recorder.ondataavailable = event => {
                if (event.data.size) {
                    this.chunks.push(event.data);
                    if (!this.unmounted) {
                        this.setState({bytes: this.chunks.reduce((total, chunk) => total + chunk.size, 0)});
                    }
                }
            };
            this.recorder.onerror = event => {
                this.setState({error: event.error?.message || this.props.intl.formatMessage(messages.errorRecordingFailed)});
                this.stopRecording(false);
            };
            this.recorder.onstop = this.handleRecorderStopped;
            this.recorder.start(1000);
            this.startedAt = Date.now();
            this.setState({phase: 'recording', elapsed: 0});
            this.statusTimer = setInterval(() => {
                this.setState({elapsed: (Date.now() - this.startedAt) / 1000});
            }, 100);
            this.durationTimer = setTimeout(() => this.stopRecording(true), this.state.duration * 1000);
            if (this.state.stopOnStop) {
                this.stopListener = () => this.stopRecording(true);
                runtime.once('PROJECT_STOP_ALL', this.stopListener);
            }
        } catch (error) {
            this.cleanupCapture();
            this.setState({phase: 'options', error: error.message || this.props.intl.formatMessage(messages.errorRecordingStart)});
        }
    }

    handleRecorderStopped = () => {
        const shouldSave = this.saveOnStop;
        const chunks = this.chunks;
        const mimeType = this.getMimeType();
        this.cleanupCapture();
        if (shouldSave && chunks.length) {
            const filename = `${this.props.projectTitle || 'video'}.${this.getExtension()}`;
            downloadBlob(filename, new Blob(chunks, {type: mimeType}));
        }
        if (!this.unmounted) this.setState({phase: 'options', elapsed: 0, bytes: 0, countdown: 0});
    };

    stopRecording (save) {
        this.saveOnStop = save;
        if (this.state.phase === 'waiting' || this.state.phase === 'delaying') {
            this.cleanupCapture();
            this.setState({phase: 'options', elapsed: 0, bytes: 0, countdown: 0});
            return;
        }
        if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    }

    handleStopAndSave = () => {
        this.stopRecording(true);
    };

    handleCancel = () => {
        this.stopRecording(false);
    };

    renderOptions () {
        return (
            <React.Fragment>
                <div className={styles.intro}>
                    <Video size={22} />
                    <div>
                        <strong>{this.props.intl.formatMessage(messages.captureStage)}</strong>
                        <span>
                            {this.props.intl.formatMessage(messages.captureStageDescription, {
                                extension: this.getExtension()
                            })}
                        </span>
                    </div>
                </div>
                <section className={styles.section}>
                    <h3><Timer size={17} /> {this.props.intl.formatMessage(messages.timing)}</h3>
                    <div className={styles.fieldGrid}>
                        <label>
                            <span>{this.props.intl.formatMessage(messages.duration)}</span>
                            <div className={styles.inputWithUnit}>
                                <input
                                    data-field="duration"
                                    max="600"
                                    min="1"
                                    type="number"
                                    value={this.state.duration}
                                    onChange={this.handleNumberChange}
                                />
                                <span>{this.props.intl.formatMessage(messages.seconds)}</span>
                            </div>
                        </label>
                        <label>
                            <span>{this.props.intl.formatMessage(messages.startDelay)}</span>
                            <div className={styles.inputWithUnit}>
                                <input
                                    data-field="delay"
                                    max="600"
                                    min="0"
                                    step="0.1"
                                    type="number"
                                    value={this.state.delay}
                                    onChange={this.handleNumberChange}
                                />
                                <span>{this.props.intl.formatMessage(messages.seconds)}</span>
                            </div>
                        </label>
                    </div>
                </section>
                <section className={styles.section}>
                    <h3><Settings2 size={17} /> {this.props.intl.formatMessage(messages.captureOptions)}</h3>
                    {this.renderToggle('projectAudio', Volume2, this.props.intl.formatMessage(messages.includeProjectAudio))}
                    {this.renderToggle('microphone', Mic, this.props.intl.formatMessage(messages.includeMicrophoneAudio))}
                    {this.renderToggle('startOnFlag', Flag, this.props.intl.formatMessage(messages.waitForFlag))}
                    {this.renderToggle('stopOnStop', Square, this.props.intl.formatMessage(messages.stopWhenProjectStops))}
                </section>
                {this.state.error && (
                    <div className={styles.notice}>
                        <CircleAlert size={17} />
                        <span>{this.state.error}</span>
                    </div>
                )}
                <div className={styles.actions}>
                    <button
                        className={styles.secondaryButton}
                        onClick={this.handleClose}
                    >
                        <X size={17} />
                        {this.props.intl.formatMessage(messages.cancel)}
                    </button>
                    <button
                        className={styles.primaryButton}
                        onClick={this.handleStart}
                    >
                        <Video size={17} />
                        {this.props.intl.formatMessage(messages.startRecording)}
                    </button>
                </div>
            </React.Fragment>
        );
    }

    renderToggle (field, Icon, label, disabled = false) {
        return (
            <label
                key={field}
                className={classNames(styles.toggleRow, {[styles.disabled]: disabled})}
            >
                <Icon size={18} />
                <span>{label}</span>
                <input
                    checked={this.state[field]}
                    data-field={field}
                    disabled={disabled}
                    type="checkbox"
                    onChange={this.handleToggle}
                />
            </label>
        );
    }

    renderStatus () {
        const waiting = this.state.phase === 'waiting';
        const delaying = this.state.phase === 'delaying';
        const elapsed = Math.min(this.state.duration, this.state.elapsed);
        const progress = this.state.duration ? (elapsed / this.state.duration) * 100 : 0;
        return (
            <div className={styles.statusPage}>
                <div className={classNames(styles.statusIcon, {[styles.recording]: !waiting && !delaying})}>
                    {waiting ? <Flag size={30} /> : delaying ? <Timer size={30} /> : <Video size={30} />}
                </div>
                <h2>
                    {waiting ? this.props.intl.formatMessage(messages.waitingForFlag) :
                        delaying ? this.props.intl.formatMessage(messages.startingShortly) :
                            this.props.intl.formatMessage(messages.recordingStage)}
                </h2>
                <p>
                    {waiting ?
                        this.props.intl.formatMessage(messages.waitingDescription) :
                        delaying ?
                            this.props.intl.formatMessage(messages.startingIn, {
                                countdown: this.state.countdown.toFixed(1)
                            }) :
                            this.props.intl.formatMessage(messages.keepOpenDescription)}
                </p>
                {!waiting && !delaying && (
                    <React.Fragment>
                        <div className={styles.progress}>
                            <span style={{width: `${progress}%`}} />
                        </div>
                        <div className={styles.stats}>
                            <div>
                                <Timer size={18} />
                                <span>{this.props.intl.formatMessage(messages.elapsed)}</span>
                                <strong>{`${elapsed.toFixed(1)}s / ${this.state.duration}s`}</strong>
                            </div>
                            <div>
                                <Download size={18} />
                                <span>{this.props.intl.formatMessage(messages.captured)}</span>
                                <strong>{formatBytes(this.state.bytes)}</strong>
                            </div>
                        </div>
                    </React.Fragment>
                )}
                {this.state.error && (
                    <div className={styles.notice}>
                        <CircleAlert size={17} />
                        <span>{this.state.error}</span>
                    </div>
                )}
                <div className={styles.actions}>
                    <button
                        className={styles.secondaryButton}
                        onClick={this.handleCancel}
                    >
                        <X size={17} />
                        {this.props.intl.formatMessage(messages.discard)}
                    </button>
                    {!waiting && !delaying && (
                        <button
                            className={styles.primaryButton}
                            onClick={this.handleStopAndSave}
                        >
                            <Square size={17} />
                            {this.props.intl.formatMessage(messages.stopAndSave)}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    render () {
        const active = this.state.phase !== 'options';
        return (
            <React.Fragment>
                <button
                    className={classNames(styles.menuButton, this.props.className, {
                        [styles.menuButtonActive]: active
                    })}
                    data-mw-item="media-recorder"
                    title={active ? this.props.intl.formatMessage(messages.recordingStatus) :
                        this.props.intl.formatMessage(messages.recordProjectVideo)}
                    type="button"
                    onClick={this.handleOpen}
                >
                    {active ? <Square size={20} /> : <Video size={20} />}
                    <span className={this.props.labelClassName}>
                        {active ? this.props.intl.formatMessage(messages.recording) :
                            this.props.intl.formatMessage(messages.record)}
                    </span>
                </button>
                {this.state.open && (
                    <AddonWindow
                        className={styles.window}
                        height={560}
                        id="media-recorder"
                        maximizable={false}
                        minimizable={false}
                        minHeight={430}
                        minWidth={380}
                        resizable
                        title={this.props.intl.formatMessage(messages.title)}
                        width={480}
                        onClose={this.handleClose}
                    >
                        <div className={styles.page}>
                            {active ? this.renderStatus() : this.renderOptions()}
                        </div>
                    </AddonWindow>
                )}
            </React.Fragment>
        );
    }
}

MediaRecorderButton.propTypes = {
    className: PropTypes.string,
    intl: intlShape.isRequired,
    labelClassName: PropTypes.string,
    projectTitle: PropTypes.string,
    vm: PropTypes.object.isRequired
};

export default injectIntl(MediaRecorderButton);
