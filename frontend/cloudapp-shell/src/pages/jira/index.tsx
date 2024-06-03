import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const Jira = dynamic(() => import("remote2/jira"), {
    ssr: false,
});

const Index: React.FC = () => {
    return (
        <>
            <Jira />
        </>
    );
};

export default Index;
