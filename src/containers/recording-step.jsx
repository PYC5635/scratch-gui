import React from 'react';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import RecordingStepComponent from '../components/record-modal/recording-step.jsx';
import AudioRecorder from '../lib/audio/audio-recorder.js';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import log from '../lib/utils/log';

const messages = defineMessages({
    alertMsg: {
        defaultMessage: 'Could not start recording',
        description: 'Alert for recording error',
        id: 'gui.recordingStep.alertMsg'
    }
});

class RecordingStep extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleRecord',
            'handleStopRecording',
            'handleStarted',
            'handleLevelUpdate',
            'handleRecordingError'
        ]);

        this.state = {
            listening: false,
            level: 0,
            levels: null
        };
    }
    componentDidMount () {
        this.audioRecorder = new AudioRecorder();
        this.audioRecorder.startListening(this.handleStarted, this.handleLevelUpdate, this.handleRecordingError);
    }
    componentWillUnmount () {
        this.audioRecorder.dispose();
    }
    handleStarted () {
        this.setState({listening: true});
    }
    handleRecordingError (error) {
        log.error(error);
        alert(this.props.intl.formatMessage(messages.alertMsg)); // eslint-disable-line no-alert
    }
    handleLevelUpdate (level) {
        this.setState({
            level: level,
            levels: this.props.recording ? this._appendLevel(level) : this.state.levels
        });
    }

    // 录音期间以 ~60fps 收到音量采样，若不限制，levels 数组会无界增长
    // 耗尽内存（录音时间越长内存占用越高，最终导致应用卡死/崩溃）。
    // 只保留最近 4096 个采样（约 68 秒）用于波形预览，足够渲染又不会失控。
    // 完整录音数据由 audioRecorder.stop() 另行返回，不影响最终保存。
    _appendLevel (level) {
        const prev = this.state.levels || [];
        if (prev.length < 4096) {
            return prev.concat([level]);
        }
        // 数组已满：移除最早的一半再追加，避免每次 concat 都复制整个数组
        const tail = prev.slice(Math.floor(prev.length / 2));
        return tail.concat([level]);
    }
    handleRecord () {
        this.audioRecorder.startRecording();
        this.props.onRecord();
    }
    handleStopRecording () {
        const {samples, sampleRate, levels, trimStart, trimEnd} = this.audioRecorder.stop();
        this.props.onStopRecording(samples, sampleRate, levels, trimStart, trimEnd);
    }
    render () {
        const {
            onRecord, // eslint-disable-line no-unused-vars
            onStopRecording, // eslint-disable-line no-unused-vars
            ...componentProps
        } = this.props;
        return (
            <RecordingStepComponent
                level={this.state.level}
                levels={this.state.levels}
                listening={this.state.listening}
                onRecord={this.handleRecord}
                onStopRecording={this.handleStopRecording}
                {...componentProps}
            />
        );
    }
}

RecordingStep.propTypes = {
    intl: intlShape.isRequired,
    onRecord: PropTypes.func.isRequired,
    onStopRecording: PropTypes.func.isRequired,
    recording: PropTypes.bool
};

export default injectIntl(RecordingStep);
