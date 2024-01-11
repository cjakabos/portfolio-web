import React from 'react';
import { Puff } from 'react-loader-spinner';

const LoadingIndicator = ({ color = '#0d1117' }) => {
    return (
        <div className="flex items-center justify-center h-40 w-full">
            <Puff
                height={80}
                width={80}
                radius={0.5}
                color={color}
                ariaLabel="puff-loading"
                wrapperStyle={{}}
                wrapperClass=""
                visible={true}
            />
        </div>
    );
};

export default LoadingIndicator;
