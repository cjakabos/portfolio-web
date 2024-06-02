import dynamic from "next/dynamic";

const ModuleTemplate = dynamic(() => import("../components/ModuleTemplate/ModuleTemplate"), {
    loading: () => <p>Loading...</p>,
    ssr: false,
});

const Index = () => {
    return (
        <section className="w-[80%] m-auto py-10 gap-10">
            <ModuleTemplate />
        </section>
    );
};

export default Index;
