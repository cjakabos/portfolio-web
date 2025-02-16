import { Html, Main, Head, NextScript } from "next/document";
import React from "react";

export default function Document() {
    return (
        <Html>
            <Head/>
            <title>Pet Store</title>
            <meta
                name="description"
                content=" Main content area - Using Next.js + Typescript + TailwindCSS"
            />
            <Main/>
            <NextScript/>
        </Html>
    );
}
