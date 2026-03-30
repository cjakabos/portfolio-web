import React from "react";
import RemoteModuleRoute from "../../components/RemoteModuleRoute";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";
import { useAuth } from "../../hooks/useAuth";

const Jira = loadRemoteComponent(() => import("remote2/jira"));

const Index: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <RemoteModuleRoute remoteKey="jira">
            <Jira />
        </RemoteModuleRoute>
    );
};

export default Index;
