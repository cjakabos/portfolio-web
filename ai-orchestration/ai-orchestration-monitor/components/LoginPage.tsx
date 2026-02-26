import React, { useContext, useState } from 'react';
import { Lock, Moon, Sun, User } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';

interface LoginPageProps {
  onLogin: (values: { username: string; password: string }) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export default function LoginPage({
  onLogin,
  loading = false,
  error = null,
}: LoginPageProps) {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const [values, setValues] = useState({ username: '', password: '' });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    try {
      await onLogin(values);
    } catch {
      setSubmitError('Authentication failed.');
    }
  };

  const visibleError = error || submitError;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="bg-gray-50 dark:bg-gray-950 p-8 text-center border-b border-gray-200 dark:border-gray-800">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center mb-4">
              <Lock className="text-blue-600 dark:text-blue-300" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Orchestration Monitor</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Admin sign-in with your CloudApp account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {visibleError && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                {visibleError}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={values.username}
                  onChange={handleChange}
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="block w-full pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="block w-full pl-10 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-70"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
