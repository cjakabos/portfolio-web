import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeContext } from './context/ThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const THEME_STORAGE_KEY = 'theme';

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'dark') return true;
  if (storedTheme === 'light') return false;

  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
};

function MonitorRoot() {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById('root');
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }

    // Ensure no stale .dark class lingers on legacy targets when switching themes.
    body.classList.remove('dark');
    appRoot?.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <App />
    </ThemeContext.Provider>
  );
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <MonitorRoot />
  </React.StrictMode>
);
