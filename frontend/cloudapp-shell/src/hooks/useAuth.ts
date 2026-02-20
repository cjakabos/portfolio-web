import { useState, useEffect } from "react";

export const useAuth = () => {
    const [token, setToken] = useState("");
    const [username, setUsername] = useState("");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const rawToken = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN");
            const t = rawToken ? `Bearer ${rawToken}` : "";
            const u = localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || "";
            setToken(t);
            setUsername(u);
            setIsReady(!!(t && u));
        }
    }, []);

    return { token, username, isReady };
};
