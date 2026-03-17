import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { AppProps } from "next/app";
import axios from 'axios';
import Script from 'next/script';
import Layout from "../components/Layout";
import AccessDenied from "../components/AccessDenied";
import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/router';
import { ThemeContext } from '../context/ThemeContext';
import { notifyCloudAppAuthStateChanged, useAuth } from '../hooks/useAuth';
import { allAuthedRoutes } from '../constants/routes';
import { normalizeTrackedUrl, trackPageview } from '../lib/analytics/umami';

type ThemePreference = 'system' | 'light' | 'dark';

function MyApp({ Component, pageProps }: AppProps) {
  const [isDark, setIsDark] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');
  const [hasMounted, setHasMounted] = useState(false);
  const [isUmamiReady, setIsUmamiReady] = useState(false);
  const router = useRouter();
  const { isAdmin, isReady, isInitialized, isChecking } = useAuth();
  const isPublicRoute = router.pathname === '/login' || router.pathname === '/logout';
  const lastTrackedUrlRef = useRef<string | null>(null);
  const umamiHostUrl = process.env.NEXT_PUBLIC_UMAMI_HOST_URL?.replace(/\/+$/, '') || '';
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || '';
  const shouldLoadUmami = Boolean(umamiHostUrl && umamiWebsiteId);

  const getSystemDarkPreference = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Client-side theme initialisation — defaults to system theme unless explicitly overridden.
  useEffect(() => {
    setHasMounted(true);

    const storedThemePreference = localStorage.getItem('themePreference');
    if (
      storedThemePreference === 'system' ||
      storedThemePreference === 'light' ||
      storedThemePreference === 'dark'
    ) {
      setThemePreference(storedThemePreference);
      setIsDark(storedThemePreference === 'dark' || (storedThemePreference === 'system' && getSystemDarkPreference()));
      return;
    }

    // Legacy migration: preserve explicit old dark preference; otherwise default to system.
    if (localStorage.getItem('theme') === 'dark') {
      setThemePreference('dark');
      setIsDark(true);
      return;
    }

    setThemePreference('system');
    setIsDark(getSystemDarkPreference());
  }, []);

  useEffect(() => {
    if (!hasMounted || themePreference !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateFromSystemTheme = (event?: MediaQueryListEvent) => {
      setIsDark(event ? event.matches : mediaQuery.matches);
    };

    updateFromSystemTheme();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateFromSystemTheme);
      return () => mediaQuery.removeEventListener('change', updateFromSystemTheme);
    }

    mediaQuery.addListener(updateFromSystemTheme);
    return () => mediaQuery.removeListener(updateFromSystemTheme);
  }, [hasMounted, themePreference]);

  // Sync dark class and browser color-scheme on <html>.
  useEffect(() => {
    if (!hasMounted) return;
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark, hasMounted]);

  useEffect(() => {
    if (!hasMounted) return;
    localStorage.setItem('themePreference', themePreference);
    if (themePreference === 'system') {
      localStorage.removeItem('theme');
      return;
    }
    localStorage.setItem('theme', themePreference);
  }, [themePreference, hasMounted]);

  const toggleTheme = () => {
    const systemPrefersDark = getSystemDarkPreference();
    const currentIsDark = themePreference === 'system' ? systemPrefersDark : themePreference === 'dark';
    const nextPreference: ThemePreference = currentIsDark ? 'light' : 'dark';
    setThemePreference(nextPreference);
    setIsDark(nextPreference === 'dark');
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
      if (!isChecking && !isReady && router.pathname !== '/login' && router.pathname !== '/logout') {
        router.replace('/login');
      }
    }
  }, [hasMounted, isInitialized, isChecking, isReady, router.pathname, router]);

  // Prevent authenticated sessions from getting stuck on /login after a successful sign-in.
  useEffect(() => {
    if (!hasMounted || !isInitialized) return;
    if (!isChecking && isReady && router.pathname === '/login') {
      router.replace('/');
    }
  }, [hasMounted, isInitialized, isChecking, isReady, router.pathname, router]);

  useEffect(() => {
    if (!hasMounted || !isUmamiReady || !router.isReady) {
      return;
    }

    const handlePageview = (url: string) => {
      const trackedUrl = normalizeTrackedUrl(url);
      if (lastTrackedUrlRef.current === trackedUrl) {
        return;
      }

      trackPageview(url);
      lastTrackedUrlRef.current = trackedUrl;
    };

    handlePageview(router.asPath);
    router.events.on('routeChangeComplete', handlePageview);

    return () => {
      router.events.off('routeChangeComplete', handlePageview);
    };
  }, [hasMounted, isUmamiReady, router]);

  if (!isPublicRoute && (!isInitialized || isChecking || !isReady)) {
    return null;
  }

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
      {shouldLoadUmami && (
        <Script
          id="umami-tracker"
          src={`${umamiHostUrl}/script.js`}
          data-auto-track="false"
          data-host-url={umamiHostUrl}
          data-website-id={umamiWebsiteId}
          strategy="afterInteractive"
          onReady={() => setIsUmamiReady(true)}
        />
      )}
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ThemeContext.Provider>
  );
}

export default MyApp;
