import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import CrashMessageComponent from '../components/crash-message/crash-message.jsx';
import log from '../lib/utils/log.js';
import downloadBlob from '../lib/utils/download-blob.js';
import {projectTitleInitialState} from '../reducers/project-title.js';

const getProjectFilename = (curTitle, defaultTitle) => {
    let filenameTitle = curTitle;
    if (!filenameTitle || filenameTitle.length === 0) {
        filenameTitle = defaultTitle;
    }
    return `${filenameTitle.substring(0, 100)}.sb3`;
};

class ErrorBoundary extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            error: null,
            errorInfo: null
        };
    }

    /**
     * Handle an error caught by this ErrorBoundary component.
     * @param {Error} error - the error that was caught.
     * @param {React.ErrorInfo} errorInfo - the React error info associated with the error.
     */
    componentDidCatch (error, errorInfo) {
        // Error object may be undefined (IE?)
        error = error || {
            stack: 'Unknown stack',
            message: 'Unknown error'
        };
        errorInfo = errorInfo || {
            componentStack: 'Unknown component stack'
        };

        // only remember the first error: later errors might just be side effects of that first one
        if (!this.state.error) {
            // store error & errorInfo for debugging
            this.setState({
                error,
                errorInfo
            });
        }

        // report every error in the console
        log.error([
            `Unhandled Error with action='${this.props.action}': ${error.stack}`,
            `Component stack: ${errorInfo.componentStack}`
        ].join('\n'));
    }

    handleBack () {
        window.history.back();
    }

    handleReload () {
        window.location.replace(window.location.origin + window.location.pathname);
    }

    handleSaveProject () {
        const {vm, projectTitle} = this.props;
        if (vm && vm.saveProjectSb3) {
            const filename = getProjectFilename(projectTitle, projectTitleInitialState);
            vm.saveProjectSb3().then(content => {
                downloadBlob(filename, content);
            });
        }
    }

    formatErrorMessage () {
        let message = '';

        if (this.state.error) {
            message += `${this.state.error}`;
        } else {
            message += 'Unknown error';
        }

        if (this.state.errorInfo) {
            const firstCoupleLines = this.state
                .errorInfo
                .componentStack
                .trim()
                .split('\n')
                .slice(0, 2)
                .map(i => i.trim());
            message += `\nComponent stack: ${firstCoupleLines.join(' ')} ...`;
        }

        return message;
    }

    render () {
        if (this.state.error) {
            return (
                <CrashMessageComponent
                    errorMessage={this.formatErrorMessage()}
                    onReload={this.handleReload}
                    onSaveProject={() => this.handleSaveProject()}
                />
            );
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    action: PropTypes.string.isRequired, // Used for defining tracking action
    children: PropTypes.node,
    projectTitle: PropTypes.string,
    vm: PropTypes.object
};

const mapStateToProps = state => ({
    projectTitle: state.scratchGui.projectTitle,
    vm: state.scratchGui.vm
});

export default connect(mapStateToProps)(ErrorBoundary);
