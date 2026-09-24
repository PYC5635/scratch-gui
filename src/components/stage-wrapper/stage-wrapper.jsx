import PropTypes from 'prop-types';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import VM from 'scratch-vm';

import Box from '../box/box.jsx';
import {STAGE_DISPLAY_SIZES} from '../../lib/constants/layout-constants.js';
import StageHeader from '../../containers/stage-header.jsx';
import Stage from '../../containers/stage.jsx';
import Loader from '../loader/loader.jsx';

import styles from './stage-wrapper.css';

const StageWrapperComponent = function (props) {
    const {
        isEmbedded,
        isFullScreen,
        isRtl,
        isRendererSupported,
        isStageHidden,
        loading,
        stageContainerWidth,
        stageMaxHeight,
        stageSize,
        vm
    } = props;

    // Box.componentRef expects a callback, not a ref object.
    const wrapperElRef = useRef(null);
    const handleWrapperRef = useCallback((node) => {
        wrapperElRef.current = node;
    }, []);
    const wasFullScreenRef = useRef(false);

    // Full-screen layout class. Toggled synchronously with the `isFullScreen`
    // prop — no enter / exit animation.
    const [isFullScreenLayout, setIsFullScreenLayout] = useState(false);

    // React to fullscreen toggles
    useLayoutEffect(() => {
        if (isFullScreen !== wasFullScreenRef.current) {
            wasFullScreenRef.current = isFullScreen;
            setIsFullScreenLayout(isFullScreen);
        }
    }, [isFullScreen]);

    // Handle initial mount: sync layout state without animation.
    useEffect(() => {
        if (isFullScreen && !wasFullScreenRef.current) {
            wasFullScreenRef.current = true;
            setIsFullScreenLayout(true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Box
            className={classNames(
                styles.stageWrapper,
                {
                    [styles.embedded]: isEmbedded,
                    [styles.fullScreen]: isFullScreenLayout,
                    [styles.loading]: loading,
                    [styles.offsetControls]: !(isEmbedded || isFullScreenLayout)
                }
            )}
            dir={isRtl ? 'rtl' : 'ltr'}
            componentRef={handleWrapperRef}
        >
            <Box className={styles.stageMenuWrapper}>
                <StageHeader
                    stageContainerWidth={stageContainerWidth}
                    stageSize={stageSize}
                    vm={vm}
                />
            </Box>
            {isStageHidden ? null : (
                <Box className={styles.stageCanvasWrapper}>
                    {
                        isRendererSupported ?
                            <Stage
                                stageContainerWidth={stageContainerWidth}
                                stageMaxHeight={stageMaxHeight}
                                stageSize={stageSize}
                                vm={vm}
                            /> :
                            null
                    }
                </Box>
            )}
            {loading ? (
                <Loader isFullScreen={isFullScreen} />
            ) : null}
        </Box>
    );
};

StageWrapperComponent.propTypes = {
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isRendererSupported: PropTypes.bool.isRequired,
    isRtl: PropTypes.bool.isRequired,
    isStageHidden: PropTypes.bool,
    loading: PropTypes.bool,
    stageContainerWidth: PropTypes.number,
    stageMaxHeight: PropTypes.number,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default StageWrapperComponent;
