import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const Maps = dynamic(() => import("remote/openmaps"), {
  ssr: false,
});

const Index: React.FC = () => {
  return (
    <div className="h-full min-h-0 w-full [&>*]:h-full">
      <Maps />
    </div>
  );
};

export default Index;
