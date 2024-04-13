"use client";
import dynamic from "next/dynamic";
import React from "react";

const Map = dynamic(() => import("../../components/OpenMaps/OpenMaps"), {
    loading: () => <p>Loading...</p>,
    ssr: false,
});

function Page() {
    return <Map />;
}

export default Page;
