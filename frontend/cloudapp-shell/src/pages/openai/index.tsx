import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const OpenAI = dynamic(() => import("remote3/openai"), {
    ssr: false,
});

const Index: React.FC = () => {
    return (
        <>
            <OpenAI />
        </>
    );
};

export default Index;
