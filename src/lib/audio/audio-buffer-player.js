import SharedAudioContext from './shared-audio-context.js';

class AudioBufferPlayer {
    constructor (samples, sampleRate) {
        this.audioContext = new SharedAudioContext();
        this.buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
        this.buffer.getChannelData(0).set(samples);
        this.source = null;

        this.startTime = null;
        this.updateCallback = null;
        this.trimStart = null;
        this.trimEnd = null;

        // 保存 rAF id，stop() 时能真正取消动画帧循环，
        // 避免 stop 后 update() 仍在飞导致 playhead 跳变或回调泄漏
        this._rafId = null;
    }

    play (trimStart, trimEnd, onUpdate, onEnded) {
        this.updateCallback = onUpdate;
        this.trimStart = trimStart;
        this.trimEnd = trimEnd;
        this.startTime = Date.now();

        const trimStartTime = this.buffer.duration * trimStart;
        const trimmedDuration = (this.buffer.duration * trimEnd) - trimStartTime;

        this.source = this.audioContext.createBufferSource();
        this.source.onended = onEnded;
        this.source.buffer = this.buffer;
        this.source.connect(this.audioContext.destination);
        this.source.start(0, trimStartTime, trimmedDuration);

        this.update();
    }

    update () {
        if (!this.source || !this.source.onended) {
            // 已 stop/dispose：停止自循环
            this._cancelFrame();
            this.updateCallback = null;
            return;
        }
        const timeSinceStart = (Date.now() - this.startTime) / 1000;
        const percentage = timeSinceStart / this.buffer.duration;
        if (percentage + this.trimStart < this.trimEnd && this.source.onended) {
            this._rafId = requestAnimationFrame(this.update.bind(this));
            this.updateCallback(percentage + this.trimStart);
        } else {
            this.updateCallback = null;
        }
    }

    stop () {
        this._cancelFrame();
        if (this.source) {
            this.source.onended = null; // Do not call onEnded callback if manually stopped
            try {
                this.source.stop();
            } catch (e) {
                // This is probably Safari, which dies when you call stop more than once
                // which the spec says is allowed: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
                console.log('Caught error while stopping buffer source node.'); // eslint-disable-line no-console
            }
        }
    }

    _cancelFrame () {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}

export default AudioBufferPlayer;
