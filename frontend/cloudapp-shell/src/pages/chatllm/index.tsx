import React from "react";
import RemoteModuleRoute from "../../components/RemoteModuleRoute";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";

const ChatLLM = loadRemoteComponent(() => import("remote3/chatllm"));

const Index: React.FC = () => {
    return (
        <RemoteModuleRoute remoteKey="chatllm">
            <ChatLLM />
        </RemoteModuleRoute>
    );
};

export default Index;
