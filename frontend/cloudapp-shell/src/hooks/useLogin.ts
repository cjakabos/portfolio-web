import { useState } from "react";
import axios from "axios";
import { ensureCloudAppCsrfToken } from "./cloudappCsrf";
import { notifyCloudAppAuthStateChanged } from "./useAuth";

interface LoginValues {
  username?: string;
  password?: string;
}

export const useLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (values: LoginValues) => {
    setLoading(true);
    setError(null);

    try {
      // Ideally, use an environment variable for the base URL
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
      const response = await axios.post(
        `${API_URL}/user/user-login`,
        { username: values.username, password: values.password },
        {
          headers: { "Content-Type": "application/json;charset=UTF-8" },
          withCredentials: true,
        }
      );
      try {
        await ensureCloudAppCsrfToken(API_URL);
      } catch (csrfError) {
        // Keep login successful even if CSRF bootstrap fails; write requests will retry.
        console.warn("CSRF bootstrap after login failed", csrfError);
      }
      notifyCloudAppAuthStateChanged();
      return response.data;
    } catch (err: any) {
      console.error("Login Error:", err);
      setError("Something went wrong. Please check your credentials.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
};
