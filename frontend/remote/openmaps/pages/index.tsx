import dynamic from "next/dynamic";

const Map = dynamic(() => import("../components/OpenMaps/OpenMaps"), {
    loading: () => <p>Loading...</p>,
    ssr: false,
});

const Index = () => {
    return (
        <section className="w-[80%] m-auto py-10 gap-10">
            <Map />
        </section>
    );
};

export default Index;
