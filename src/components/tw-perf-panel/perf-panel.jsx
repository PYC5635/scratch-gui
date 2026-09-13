import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import styles from './perf-panel.css';

/**
 * PineEditor 性能分析面板
 * -----------------------
 * 分析哪段积木最耗时（topBlocks）、整体复杂度、以及 GPU/渲染占用率。
 *
 * 集成方式：把该组件挂载到 GUI，并在 componentDidMount 里注册全局开关
 *   window.__pinePerfToggle = this.handleToggle
 * 组件会用 vm.enablePerformanceAnalysis / vm.getPerformanceSnapshot /
 * vm.getBlockComplexity 与 scratch-vm 运行时通信，无需额外改动 VM 代码。
 *
 * 若想分析某块积木的复杂度，可点击面板中的“分析选中积木”，它会读取
 * props.vm.editingTarget.blocks 并以当前选中的积木 id 计算复杂度。
 */
class PerfPanel extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleStart',
            'handleStop',
            'handleClose',
            'handleAnalyzeComplexity'
        ]);
        this.state = {
            visible: false,
            running: false,
            snapshot: null,
            complexity: null
        };
        this.pollTimer = null;
    }

    componentWillUnmount () {
        this.stopPoll();
        window.__pinePerfToggle = null;
    }

    startPoll () {
        this.stopPoll();
        this.pollTimer = setInterval(() => {
            try {
                if (this.props.vm && this.props.vm.getPerformanceSnapshot) {
                    const snapshot = this.props.vm.getPerformanceSnapshot();
                    this.setState({snapshot});
                }
            } catch (e) { /* ignore */ }
        }, 500);
    }

    stopPoll () {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    handleStart () {
        if (this.props.vm && this.props.vm.enablePerformanceAnalysis) {
            this.props.vm.enablePerformanceAnalysis(2000);
        }
        this.setState({running: true, snapshot: null});
        this.startPoll();
        // 2 秒后自动结束采样
        setTimeout(() => {
            if (this.props.vm && this.props.vm.stopPerformanceAnalysis) {
                this.props.vm.stopPerformanceAnalysis();
            }
            this.setState({running: false});
            this.stopPoll();
        }, 2200);
    }

    handleStop () {
        if (this.props.vm && this.props.vm.stopPerformanceAnalysis) {
            this.props.vm.stopPerformanceAnalysis();
        }
        this.setState({running: false});
        this.stopPoll();
    }

    handleAnalyzeComplexity () {
        if (!this.props.vm || !this.props.vm.getBlockComplexity) return;
        const target = this.props.vm.editingTarget;
        if (!target || !target.blocks) return;
        // 找不到选中积木时取当前脚本栈顶，否则分析第一个脚本
        const ids = Object.keys(target.blocks._blocks || {});
        const startId = ids.find(id => target.blocks.getRoot(id)) || ids[0];
        if (!startId) return;
        const complexity = this.props.vm.getBlockComplexity(target.blocks._blocks, startId);
        this.setState({complexity});
    }

    handleClose () {
        this.handleStop();
        this.setState({visible: false});
        if (this.props.onClose) {
            this.props.onClose();
        }
    }

    renderGpu (gpuLoad) {
        const pct = Math.max(0, Math.min(100, gpuLoad || 0));
        const level = pct < 33 ? 'low' : (pct < 66 ? 'mid' : 'high');
        return (
            <div className={styles.gpuBar}>
                <div
                    className={`${styles.gpuFill} ${styles[level]}`}
                    style={{width: `${pct}%`}}
                    title={`GPU 占用率 ${pct}%`}
                />
            </div>
        );
    }

    render () {
        if (!this.props.vm) return null;
        const snap = this.state.snapshot || {};
        const gpuLoad = typeof snap.gpuLoad === 'number' ? snap.gpuLoad : null;

        return (
            <div className={styles.panel}>
                <div className={styles.header}>
                    <span className={styles.title}>🍍 性能剖析</span>
                    <span className={styles.controls}>
                        {!this.state.running ? (
                            <button className={styles.btn} onClick={this.handleStart}>开始采样</button>
                        ) : (
                            <button className={styles.btn} onClick={this.handleStop}>停止</button>
                        )}
                        <button className={styles.btn} onClick={this.handleAnalyzeComplexity}>分析复杂度</button>
                        <button className={`${styles.btn} ${styles.close}`} onClick={this.handleClose}>关闭</button>
                    </span>
                </div>
                <div className={styles.metrics}>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{snap.fps || '—'}</span>
                        <span className={styles.metricLabel}>FPS</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{gpuLoad !== null ? `${gpuLoad}%` : '—'}</span>
                        <span className={styles.metricLabel}>GPU</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{snap.avgFrameTime != null ? `${snap.avgFrameTime}ms` : '—'}</span>
                        <span className={styles.metricLabel}>均帧耗时</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricValue}>{snap.avgDrawables != null ? snap.avgDrawables : '—'}</span>
                        <span className={styles.metricLabel}>Drawable</span>
                    </div>
                </div>
                {gpuLoad !== null && this.renderGpu(gpuLoad)}
                {(snap.topBlocks || []).length > 0 && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>积木 (opcode)</th>
                                <th>调用</th>
                                <th>自耗(ms)</th>
                                <th>均耗(ms)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snap.topBlocks.slice(0, 10).map((b, i) => (
                                <tr key={`${b.opcode}-${i}`}>
                                    <td title={b.opcode}>{b.opcode}</td>
                                    <td>{b.calls}</td>
                                    <td>{b.selfTime}</td>
                                    <td>{b.avg}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {this.state.complexity && (
                    <div className={styles.complexity}>
                        脚本复杂度得分: <strong>{this.state.complexity.score}</strong> ·
                        循环 {this.state.complexity.loops} · 分支 {this.state.complexity.branches} ·
                        调用 {this.state.complexity.calls}
                        {this.state.complexity.hotBlocks.length > 0 && (
                            <div className={styles.hotBlocks}>
                                热点: {this.state.complexity.hotBlocks.map(h => h.opcode).join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
}

PerfPanel.propTypes = {
    vm: PropTypes.object,
    onClose: PropTypes.func
};

export default PerfPanel;