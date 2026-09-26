import React from 'react';

const PineWarpLogo = ({className, alt}) => (
    <span
        className={className}
        role="img"
        aria-label={alt}
        style={{
            fontSize: '32px',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}
    >
        🍍
    </span>
);

export default PineWarpLogo;