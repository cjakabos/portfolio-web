'use client';
import { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";

function CustomApp({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <title>Jira Module with LLM chat - Remote</title>
                <meta name="description" content="JiraLLM App" />
            </Head>
            <main className="app">
                <Component {...pageProps} />
            </main>
        </>
    );
}

export default CustomApp;
