
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Lock, User } from 'lucide-react';
import { useLogin } from "../../hooks/useLogin";
import { useRegister } from "../../hooks/useRegister";

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setValues({
          ...values,
          [name]: value,
      });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await register(values);
        await login(values);
      } else {
        await login(values);
      }
      router.push('/');
    } catch (err: any) {
      (err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-900 p-8 text-center border-b border-gray-200 dark:border-gray-700">
          <div className="mx-auto w-40 h-40 bg-gray-800 rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-600 mb-4 shadow-inner p-2">
            <img src="/drawing_white.svg" alt="CloudApp" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">CloudApp</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
              onClick={() => setIsRegister(!isRegister)}
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
