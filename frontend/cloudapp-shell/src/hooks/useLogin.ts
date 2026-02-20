import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

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
        { headers: { "Content-Type": "application/json;charset=UTF-8" } }
      );


      const token = response.headers.authorization;
      if (typeof window !== "undefined") {
        localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", values.username);
        localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", token);
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
