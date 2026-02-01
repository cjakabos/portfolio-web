import * as React from 'react';
import { useState, useEffect } from 'react';
import type { AppProps } from "next/app";
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent hydration mismatch
  if (!isClient) return null;

  return (
        <Component {...pageProps} />
  );
}

export default MyApp;