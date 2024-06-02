import React from "react";
import dynamic from "next/dynamic";

// @ts-ignore
const Maps = dynamic(() => import("remote/openmaps"), {
  ssr: false,
});

const ModuleTemplate = dynamic(() => import("moduletemplate/moduletemplate"), {
  ssr: false,
});


const Index: React.FC = () => {
  return (
      <>
          <ModuleTemplate />
          <Maps />
      </>
  );
};

export default Index;
