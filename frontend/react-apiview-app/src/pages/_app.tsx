import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import Layout from "@/components/Layout";

export default function App({
  Component,
  pageProps: { pageProps },
}: AppProps) {
  return (
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
          <Layout>
              <Component {...pageProps} />
          </Layout>
      </NextThemesProvider>
  );
}
