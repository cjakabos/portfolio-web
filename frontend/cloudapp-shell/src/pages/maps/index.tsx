import React from "react";
import RemoteModuleRoute from "../../components/RemoteModuleRoute";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";

const Maps = loadRemoteComponent(() => import("remote/openmaps"));

const Index: React.FC = () => {
  return (
    <RemoteModuleRoute remoteKey="openmaps">
      <div className="h-full min-h-0 w-full [&>*]:h-full">
        <Maps />
      </div>
    </RemoteModuleRoute>
  );
};

export default Index;
