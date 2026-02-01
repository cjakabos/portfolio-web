import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const PetStore = dynamic(() => import("remote5/petstore"), {
    ssr: false,
});

const PetStorePage: React.FC = () => {
    return (
        <div className="h-screen w-full">
            <PetStore />
        </div>
    );
};

export default PetStorePage;