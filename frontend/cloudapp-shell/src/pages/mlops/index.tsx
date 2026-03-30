import React from "react";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";
import { useAuth } from "../../hooks/useAuth";

const MLOps = loadRemoteComponent(() => import("remote4/mlops"));

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
