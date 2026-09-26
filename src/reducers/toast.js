const initialState = {
    visible: false,
    message: null,
    type: 'info',
    // Which corner the toast slides into. Errors raised by the git layer ask
    // for 'bottom-right' (A3) — they are triggered from inside the git window,
    // and the bottom corner keeps them clear of the window header, while the
    // rest of the app keeps the original top-right position.
    position: 'top-right'
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case 'scratch-gui/SHOW_TOAST':
        return Object.assign({}, state, {
            visible: true,
            message: action.message,
            type: action.toastType || 'info',
            position: action.position || initialState.position
        });
    case 'scratch-gui/HIDE_TOAST':
        return Object.assign({}, state, {
            visible: false
        });
    default:
        return state;
    }
};

export {
    reducer as default,
    initialState as toastInitialState
};
