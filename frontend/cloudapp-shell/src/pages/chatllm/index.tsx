import React from "react";
import { loadRemoteComponent } from "../../lib/loadRemoteComponent";

const ChatLLM = loadRemoteComponent(() => import("remote3/chatllm"));

const Index: React.FC = () => {
    return (
        <>
            <ChatLLM />
        </>
    );
};

export default Index;
