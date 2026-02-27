import { useState } from "react";
import axios from "axios";
import { getCloudAppCsrfHeaders } from "./cloudappCsrf";
import { notifyCloudAppAuthStateChanged } from "./useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useLogout = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const logout = async () => {
        setLoading(true);
        setError(null);

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
            notifyCloudAppAuthStateChanged();
        } catch (err) {
            console.error("Logout Error:", err);
            setError("Logout request failed.");
        } finally {
            setLoading(false);
        }
    };

    return { logout, loading, error };
};
