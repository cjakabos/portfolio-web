import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const ChatLLM = dynamic(() => import("remote3/chatllm"), {
    ssr: false,
});

const Index: React.FC = () => {
    return (
        <>
            <ChatLLM />
        </>
    );
};

export default Index;
