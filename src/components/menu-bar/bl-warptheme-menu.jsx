import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';
import {MenuItem} from '../menu/menu.jsx';
import {openWarpthemeModal} from '../../reducers/modals';

import {Globe} from 'lucide-react';

class WarpthemeMenu extends React.Component {
    handleClick () {
        this.props.onOpenWarptheme();
        if (this.props.onRequestClose) {
            this.props.onRequestClose();
        }
    }

    render () {
        return (
            <MenuItem
                onClick={() => this.handleClick()}
            >
                <Globe size={16} />
                <FormattedMessage
                    defaultMessage="WarpTheme Store"
                    description="Menu item to open WarpTheme store"
                    id="bl.menu.warptheme"
                />
            </MenuItem>
        );
    }
}

WarpthemeMenu.propTypes = {
    onOpenWarptheme: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func
};

const mapDispatchToProps = dispatch => ({
    onOpenWarptheme: () => {
        dispatch(openWarpthemeModal());
    }
});

export default connect(
    null,
    mapDispatchToProps
)(WarpthemeMenu);
