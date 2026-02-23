import { useState, useEffect } from "react";

const TOKEN_STORAGE_KEY = "NEXT_PUBLIC_MY_TOKEN";
const USERNAME_STORAGE_KEY = "NEXT_PUBLIC_MY_USERNAME";
const BEARER_PREFIX = "Bearer ";

const formatAuthorizationToken = (storedToken: string | null) => {
    const token = storedToken?.trim() || "";
    if (!token) return "";
    return token.startsWith(BEARER_PREFIX) ? token : `${BEARER_PREFIX}${token}`;
};

export const useAuth = () => {
    const [token, setToken] = useState("");
    const [username, setUsername] = useState("");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const t = formatAuthorizationToken(localStorage.getItem(TOKEN_STORAGE_KEY));
            const u = localStorage.getItem(USERNAME_STORAGE_KEY) || "";
            setToken(t);
            setUsername(u);
            setIsReady(!!(t && u));
        }
    }, []);

    return { token, username, isReady };
};
