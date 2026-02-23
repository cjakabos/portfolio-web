import { useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
const TOKEN_STORAGE_KEY = "NEXT_PUBLIC_MY_TOKEN";
const USERNAME_STORAGE_KEY = "NEXT_PUBLIC_MY_USERNAME";
const BEARER_PREFIX = "Bearer ";

const formatAuthorizationToken = (storedToken: string | null) => {
    const token = storedToken?.trim() || "";
    if (!token) return "";
    return token.startsWith(BEARER_PREFIX) ? token : `${BEARER_PREFIX}${token}`;
};

const clearStoredAuth = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(USERNAME_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export const useLogout = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const logout = async () => {
        setLoading(true);
        setError(null);

        try {
            const headers: Record<string, string> = {};
            if (typeof window !== "undefined") {
                const token = formatAuthorizationToken(localStorage.getItem(TOKEN_STORAGE_KEY));
                if (token) {
                    headers.Authorization = token;
                }
            }

            await axios.post(
                `${API_URL}/user/user-logout`,
                {},
                {
                    headers,
                    withCredentials: true,
                }
            );
        } catch (err) {
            console.error("Logout Error:", err);
            setError("Logout request failed; local session was cleared.");
        } finally {
            clearStoredAuth();
            setLoading(false);
        }
    };

    return { logout, loading, error };
};

