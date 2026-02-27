import React from "react";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";

// @ts-ignore
const Jira = dynamic(() => import("remote2/jira"), {
    ssr: false,
});

const Index: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <>
            <Jira />
        </>
    );
};

export default Index;
