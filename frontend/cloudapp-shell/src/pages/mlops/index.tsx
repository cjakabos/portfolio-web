import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const MLOps = dynamic(() => import("remote4/mlops"), {
    ssr: false,
});

const Index: React.FC = () => {
    return (
        <>
            <MLOps />
        </>
    );
};

export default Index;
