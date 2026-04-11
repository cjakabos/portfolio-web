import { useState } from "react";
import { ensureCloudAppCsrfToken } from "./cloudappCsrf";
import { notifyCloudAppAuthStateChanged } from "./useAuth";
import { getCloudAppApiUrl, loginCloudAppUser } from "./cloudappClient";

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
      const username = values.username?.trim().toLowerCase() ?? "";
      const password = values.password ?? "";
      const apiUrl = getCloudAppApiUrl();
      const response = await loginCloudAppUser({
        username,
        password,
        apiUrl,
      });
      try {
        await ensureCloudAppCsrfToken(apiUrl);
      } catch (csrfError) {
        // Keep login successful even if CSRF bootstrap fails; write requests will retry.
        console.warn("CSRF bootstrap after login failed", csrfError);
      }
      notifyCloudAppAuthStateChanged();
      return response;
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
