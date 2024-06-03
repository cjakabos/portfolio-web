import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const PetStore = dynamic(() => import("remote5/petstore"), {
    ssr: false,
});

const Index: React.FC = () => {
    return (
        <>
            <PetStore />
        </>
    );
};

export default Index;
