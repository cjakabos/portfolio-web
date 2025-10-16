import { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";

function CustomApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Chat with LLM- Remote</title>
        <meta name="description" content="ChatLLM App" />
      </Head>
      <main className="app">
        <Component {...pageProps} />
      </main>
    </>
  );
}

export default CustomApp;
