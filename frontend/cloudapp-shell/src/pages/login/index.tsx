
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Lock, User } from 'lucide-react';
import { useLogin } from "../../hooks/useLogin";
import { useRegister } from "../../hooks/useRegister";
import { useAuth } from '../../hooks/useAuth';
import { trackEvent } from '../../lib/analytics/umami';

const initialValues = {
    firstname: "",
    lastname: "",
    username: "",
    password: "",
    confirmPassword: "",
};

const Login: React.FC = () => {
  // Use the custom hook
  const { login, error: loginError } = useLogin();
  // Use the custom hook
  const { register, errorType: registerError } = useRegister();
  const [values, setValues] = useState(initialValues);

  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { isReady, isInitialized, isChecking } = useAuth();

  useEffect(() => {
    if (!isInitialized || isChecking) return;
    if (isReady) {
      void router.replace('/');
    }
  }, [isInitialized, isChecking, isReady, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const normalizedValue = name === "username" ? value.toLowerCase() : value;
      setValues({
          ...values,
          [name]: normalizedValue,
      });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const registerSucceeded = await register(values);
        if (!registerSucceeded) {
          return;
        }
        trackEvent('auth_register_success', {
          method: 'password',
          username_length: values.username.length,
        });
        await login(values);
        trackEvent('auth_login_success', {
          method: 'register_auto_login',
          username_length: values.username.length,
        });
      } else {
        await login(values);
        trackEvent('auth_login_success', {
          method: 'password',
          username_length: values.username.length,
        });
      }
      if (typeof window !== 'undefined') {
        window.location.assign('/');
        return;
      }
      await router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-5 sm:p-8 text-center border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto h-24 w-24 sm:h-40 sm:w-40 bg-gray-800 rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-600 mb-3 sm:mb-4 shadow-inner p-2">
            <Image src="/drawing_white.svg" alt="CloudApp" width={160} height={160} className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">CloudApp</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
          {loginError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {loginError}
            </div>
          )}
          {isRegister ? 'Create Account' : 'Sign In'}
          {isRegister && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">First name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="text-gray-400 dark:text-gray-500" size={18} />
                    </div>
                    <input
                      className="block w-full pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            type="text"
                            name="firstname"
                            id="firstname"
                            placeholder="Enter First Name"
                            onChange={handleChange}
                            value={values.firstname}
                            maxLength={20}
                            required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Last name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="text-gray-400 dark:text-gray-500" size={18} />
                    </div>
                    <input
                      className="block w-full pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            type="text"
                            name="lastname"
                            id="lastname"
                            placeholder="Enter Last Name"
                            onChange={handleChange}
                            value={values.lastname}
                            maxLength={20}
                            required
                    />
                  </div>
                </div>
              </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
                <input
                  className="block w-full pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            type="text"
                            name="username"
                            id="username"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="Enter Username"
                            onChange={handleChange}
                            value={values.username}
                            maxLength={20}
                            required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
                <input
                  className="block w-full pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            type="password"
                            name="password"
                            id="password"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="Enter Password"
                            onChange={handleChange}
                            value={values.password}
                            maxLength={20}
                            required
                />
              </div>
            </div>
          </div>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Confirm password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-gray-400 dark:text-gray-500" size={18} />
                </div>
                <input
                  className="block w-full pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            type="password"
                            name="confirmPassword"
                            id="confirmPassword"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="••••••••"
                            onChange={handleChange}
                            value={values.confirmPassword}
                            maxLength={20}
                            required
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg"
          >
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                trackEvent('auth_mode_toggle', {
                  mode: !isRegister ? 'register' : 'login',
                });
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
