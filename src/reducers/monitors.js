const UPDATE_MONITORS = 'scratch-gui/monitors/UPDATE_MONITORS';
import {OrderedMap} from 'immutable';

const initialState = OrderedMap();

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE_MONITORS:
        return action.monitors;
    default:
        return state;
    }
};

const updateMonitors = function (monitors) {
    return {
        type: UPDATE_MONITORS,
        monitors: monitors,
        meta: {
            // The VM fires MONITORS_UPDATE on every frame where any monitored
            // value changed; coalesce to ~10Hz, well within the refresh
            // resolution the stage monitors render at.
            throttle: 100
        }
    };
};

export {
    reducer as default,
    initialState as monitorsInitialState,
    updateMonitors
};
