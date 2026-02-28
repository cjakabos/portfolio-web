import * as React from 'react';
import { useState, useEffect } from 'react';
import type { AppProps } from "next/app";
import axios from 'axios';
import Layout from "../components/Layout";
import AccessDenied from "../components/AccessDenied";
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/router';
import { ThemeContext } from '../context/ThemeContext';
import { notifyCloudAppAuthStateChanged, useAuth } from '../hooks/useAuth';
import { allAuthedRoutes } from '../constants/routes';

function MyApp({ Component, pageProps }: AppProps) {
  const [isDark, setIsDark] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const router = useRouter();
  const { isAdmin, isReady, isInitialized } = useAuth();

  // Client-side theme initialisation — reads localStorage once after mount.
  useEffect(() => {
    setHasMounted(true);
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
    }
  }, []);

  // Sync the `dark` class on <html> whenever the theme changes (client only).
  useEffect(() => {
    if (!hasMounted) return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark, hasMounted]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // Axios interceptor — redirect to login when the authenticated session expires.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (router.pathname !== '/login' && router.pathname !== '/logout' && error.response?.status === 401) {
          notifyCloudAppAuthStateChanged();
          router.push('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => { axios.interceptors.response.eject(interceptor); };
  }, [router]);

  // Auth guard — redirect unauthenticated users to /login (client-side only).
  useEffect(() => {
    if (hasMounted && isInitialized) {
      if (!isReady && router.pathname !== '/login' && router.pathname !== '/logout') {
        router.push('/login');
      }
    }
  }, [hasMounted, isInitialized, isReady, router.pathname, router]);

  // ---- Route-level access control (evaluated on every render) ----
  const currentRoute = allAuthedRoutes.find(r =>
    r.path === '/' ? router.pathname === '/' : router.pathname.startsWith(r.path)
  );
  const isAdminRoute = Boolean(currentRoute?.adminOnly);
  const isAccessDenied = isReady && currentRoute?.adminOnly && !isAdmin;

  // For admin-only routes, defer rendering until auth state is resolved so
  // we don't flash the page content before RBAC can deny access.
  if (isAdminRoute && !isInitialized) {
    return null;
  }

  if (isAdminRoute && !isReady) {
    return null;
  }

  if (isAccessDenied) {
    return (
      <ThemeContext.Provider value={{ isDark, toggleTheme }}>
        <Layout>
          <AccessDenied />
        </Layout>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ThemeContext.Provider>
  );
}

export default MyApp;
