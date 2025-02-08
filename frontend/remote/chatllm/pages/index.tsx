import dynamic from "next/dynamic";

const ChatLLM = dynamic(() => import("../components/ChatLLM/ChatLLM"), {
    loading: () => <p>Loading...</p>,
    ssr: false,
});

const Index = () => {
    return (
        <section className="flex items-center justify-center w-[80%] m-auto py-10 gap-10">
            <ChatLLM />
        </section>
    );
};

export default Index;
