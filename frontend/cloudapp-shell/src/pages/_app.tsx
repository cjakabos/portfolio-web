import * as React from 'react';
import { useState, useEffect } from 'react';
import type { AppProps } from "next/app";
import axios from 'axios';
import Layout from "../components/Layout";
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/router';
import { ThemeContext } from '../context/ThemeContext';
import { isTokenExpired } from '../hooks/useAuth';

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

  // Axios interceptor — force logout on 401 or on network errors when the token is expired
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (router.pathname !== '/login') {
          const token = localStorage.getItem('NEXT_PUBLIC_MY_TOKEN');
          const is401 = error.response?.status === 401;
          const isNetworkErrorWithExpiredToken =
            !error.response && isTokenExpired(token);
          if ((is401 || isNetworkErrorWithExpiredToken) && token) {
            localStorage.removeItem('NEXT_PUBLIC_MY_TOKEN');
            localStorage.removeItem('NEXT_PUBLIC_MY_USERNAME');
            router.push('/login');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => { axios.interceptors.response.eject(interceptor); };
  }, [router]);

  // Auth Guard Logic
  useEffect(() => {
    if (isClient) {
      const user = localStorage.getItem('NEXT_PUBLIC_MY_USERNAME');
      const token = localStorage.getItem('NEXT_PUBLIC_MY_TOKEN');
      if ((!user || isTokenExpired(token)) && router.pathname !== '/login') {
        localStorage.removeItem('NEXT_PUBLIC_MY_TOKEN');
        localStorage.removeItem('NEXT_PUBLIC_MY_USERNAME');
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