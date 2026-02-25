import { useState } from "react";
import axios from "axios";
import { getCloudAppCsrfHeaders } from "./cloudappCsrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
const USERNAME_STORAGE_KEY = "NEXT_PUBLIC_MY_USERNAME";
const TOKEN_STORAGE_KEY = "NEXT_PUBLIC_MY_TOKEN";

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
        clearStoredAuth();

        try {
            const headers = await getCloudAppCsrfHeaders(API_URL);
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
            setLoading(false);
        }
    };

    return { logout, loading, error };
};
