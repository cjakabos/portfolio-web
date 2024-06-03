import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const Maps = dynamic(() => import("remote/openmaps"), {
  ssr: false,
});

const Index: React.FC = () => {
  return (
      <>
          <Maps />
      </>
  );
};

export default Index;
