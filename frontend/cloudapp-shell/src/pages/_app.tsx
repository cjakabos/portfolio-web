import * as React from 'react';
import { useState, useEffect } from 'react';
import type { AppProps } from "next/app";
import Layout from "../components/Layout";
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/router';
import { ThemeContext } from '../context/ThemeContext';

function MyApp({ Component, pageProps }: AppProps) {
  const [isDark, setIsDark] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }, [isDark, isClient]);

  const toggleTheme = () => {
      console.log("Toggle triggered in App");
      setIsDark((prev) => !prev);
  };

  // Auth Guard Logic
  useEffect(() => {
    if (isClient) {
      const user = localStorage.getItem('NEXT_PUBLIC_MY_USERNAME');
      // Added simple check to prevent loop if already on /login
      if (!user && router.pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [isClient, router.pathname]);

  // Prevent hydration mismatch
  if (!isClient) return null;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ThemeContext.Provider>
  );
}

export default MyApp;