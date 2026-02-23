import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ensureCloudAppCsrfToken } from "./cloudappCsrf";

const TOKEN_STORAGE_KEY = "NEXT_PUBLIC_MY_TOKEN";
const USERNAME_STORAGE_KEY = "NEXT_PUBLIC_MY_USERNAME";
const BEARER_PREFIX = "Bearer ";

const normalizeTokenForStorage = (authorizationHeader?: string) => {
  const token = authorizationHeader?.trim() || "";
  if (!token) return "";
  return token.startsWith(BEARER_PREFIX)
    ? token.slice(BEARER_PREFIX.length)
    : token;
};

interface LoginValues {
  username?: string;
  password?: string;
}

export const useLogin = () => {
  const router = useRouter();
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

      const token = normalizeTokenForStorage(response.headers.authorization);
      if (!token) {
        throw new Error("Login succeeded but no Authorization token was returned");
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(USERNAME_STORAGE_KEY, values.username || "");
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      try {
        await ensureCloudAppCsrfToken(API_URL);
      } catch (csrfError) {
        // Keep login successful even if CSRF bootstrap fails; write requests will retry.
        console.warn("CSRF bootstrap after login failed", csrfError);
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      setError("Something went wrong. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
};
