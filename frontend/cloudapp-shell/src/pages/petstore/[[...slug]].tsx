import React from "react";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";

// @ts-ignore
const PetStore = dynamic(() => import("remote5/petstore"), {
    ssr: false,
});

const PetStorePage: React.FC = () => {
    const { isAdmin, isReady, isInitialized } = useAuth();

    if (!isInitialized || !isReady || !isAdmin) {
        return null;
    }

    return (
        <div className="h-screen w-full">
            <PetStore />
        </div>
    );
};

export default PetStorePage;
