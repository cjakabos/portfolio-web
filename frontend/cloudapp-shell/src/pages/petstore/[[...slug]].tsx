import React from "react";
import RemoteModuleRoute from "../../components/RemoteModuleRoute";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";
import { useAuth } from "../../hooks/useAuth";

const PetStore = loadRemoteComponent(() => import("remote5/petstore"));

const PetStorePage: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <RemoteModuleRoute remoteKey="petstore">
            <div className="h-full min-h-0 w-full">
                <PetStore />
            </div>
        </RemoteModuleRoute>
    );
};

export default PetStorePage;
