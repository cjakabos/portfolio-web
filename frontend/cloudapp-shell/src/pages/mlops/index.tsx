import React from "react";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";

// @ts-ignore
const MLOps = dynamic(() => import("remote4/mlops"), {
    ssr: false,
});

const Index: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <>
            <MLOps />
        </>
    );
};

export default Index;
