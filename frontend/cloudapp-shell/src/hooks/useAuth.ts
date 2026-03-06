import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
export const CLOUDAPP_AUTH_STATE_CHANGED_EVENT = "cloudapp-auth-state-changed";

type AuthCheckResponse = {
  username: string;
  roles?: string[];
};

export const notifyCloudAppAuthStateChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLOUDAPP_AUTH_STATE_CHANGED_EVENT));
};

export const useAuth = () => {
  const [username, setUsername] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const refreshAuthState = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await axios.get<AuthCheckResponse>(`${API_URL}/user/auth-check`, {
        withCredentials: true,
      });
      const nextUsername = response.data?.username?.trim() || "";
      const nextRoles = Array.isArray(response.data?.roles)
        ? response.data.roles.filter((role): role is string => typeof role === "string")
        : [];

      setUsername(nextUsername);
      setRoles(nextRoles);
      setIsReady(Boolean(nextUsername));
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 401 && status !== 403) {
        console.error("CloudApp auth check failed", error);
      }
      setUsername("");
      setRoles([]);
      setIsReady(false);
    } finally {
      setIsInitialized(true);
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthState();
  }, [refreshAuthState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleAuthChanged = () => {
      void refreshAuthState();
    };

    window.addEventListener(CLOUDAPP_AUTH_STATE_CHANGED_EVENT, handleAuthChanged);
    return () => window.removeEventListener(CLOUDAPP_AUTH_STATE_CHANGED_EVENT, handleAuthChanged);
  }, [refreshAuthState]);

  const normalizedRoles = roles.map((role) => role.trim().toUpperCase());
  const isAdmin = normalizedRoles.includes("ROLE_ADMIN") || normalizedRoles.includes("ADMIN");

  return { username, roles, isAdmin, isReady, isInitialized, isChecking };
};
