import dynamic from "next/dynamic";

const ChatLLM = dynamic(() => import("../components/ChatLLM/ChatLLM"), {
    loading: () => <p>Loading...</p>,
    ssr: false,
});

const Index = () => {
    return (
        <section className="">
            <ChatLLM />
        </section>
    );
};

export default Index;
