import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import PerfPanel from '../components/tw-perf-panel/perf-panel.jsx';
import {openPerfModal, closePerfModal} from '../reducers/modals';

class TWPerfPanel extends React.Component {
    constructor (props) {
        super(props);
        this.handleClose = this.handleClose.bind(this);
        this.handleOpen = this.handleOpen.bind(this);
        this.handleToggle = this.handleToggle.bind(this);
    }

    componentDidMount () {
        window.__pinewarpPerfToggle = this.handleToggle;
    }

    componentWillUnmount () {
        if (window.__pinewarpPerfToggle === this.handleToggle) {
            window.__pinewarpPerfToggle = null;
        }
    }

    handleOpen () {
        if (!this.props.visible) {
            this.props.onOpen();
        }
    }

    handleClose () {
        this.props.onClose();
    }

    handleToggle () {
        if (this.props.visible) {
            this.props.onClose();
        } else {
            this.props.onOpen();
        }
    }

    render () {
        if (!this.props.visible) {
            return null;
        }
        return (
            <PerfPanel
                vm={this.props.vm}
                onClose={this.handleClose}
            />
        );
    }
}

TWPerfPanel.propTypes = {
    vm: PropTypes.instanceOf(VM).isRequired,
    visible: PropTypes.bool,
    onOpen: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    visible: state.scratchGui.modals.perfModal
});

const mapDispatchToProps = dispatch => ({
    onOpen: () => dispatch(openPerfModal()),
    onClose: () => dispatch(closePerfModal())
});

export default connect(mapStateToProps, mapDispatchToProps)(TWPerfPanel);