import React from "react";
import RemoteModuleRoute from "../../components/RemoteModuleRoute";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";
import { useAuth } from "../../hooks/useAuth";

const MLOps = loadRemoteComponent(() => import("remote4/mlops"));

const Index: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <RemoteModuleRoute remoteKey="mlops">
            <MLOps />
        </RemoteModuleRoute>
    );
};

export default Index;
