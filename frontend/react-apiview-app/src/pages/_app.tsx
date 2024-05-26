import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import Header from "@/components/Header";

export default function App({
  Component,
  pageProps: { pageProps },
}: AppProps) {
  return (
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
          <Header/>
          <body className="pt-16">
            <Component {...pageProps} />
          </body>
      </NextThemesProvider>
  );
}
