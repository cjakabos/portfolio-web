import React from "react";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";

const Maps = loadRemoteComponent(() => import("remote/openmaps"));

const Index: React.FC = () => {
  return (
    <div className="h-full min-h-0 w-full [&>*]:h-full">
      <Maps />
    </div>
  );
};

export default Index;
