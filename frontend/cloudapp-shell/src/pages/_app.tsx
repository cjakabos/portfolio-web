import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import Layout from "@/components/Layout";

import type { ReactElement, ReactNode } from 'react'
import type { NextPage } from 'next'

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
    getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout
}

export default function App({
  Component,
  pageProps: { pageProps },
}: AppPropsWithLayout) {
    // Use the layout defined at the page level, if available
    if (Component.getLayout) {
        return Component.getLayout(<Component {...pageProps} />);
    } else {
        return (
            <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
                <Layout>
                    <Component {...pageProps} />
                </Layout>
            </NextThemesProvider>
        )
    }

}
