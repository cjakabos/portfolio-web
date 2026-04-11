import { useState } from "react";
import { notifyCloudAppAuthStateChanged } from "./useAuth";
import { getCloudAppApiUrl, logoutCloudAppUser } from "./cloudappClient";

export const useLogout = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const logout = async () => {
        setLoading(true);
        setError(null);

        try {
            await logoutCloudAppUser({ apiUrl: getCloudAppApiUrl() });
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
