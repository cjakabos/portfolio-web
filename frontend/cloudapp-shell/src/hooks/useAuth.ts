import { useState, useEffect } from "react";

const TOKEN_STORAGE_KEY = "NEXT_PUBLIC_MY_TOKEN";
const USERNAME_STORAGE_KEY = "NEXT_PUBLIC_MY_USERNAME";
const BEARER_PREFIX = "Bearer ";

const formatAuthorizationToken = (storedToken: string | null) => {
    const token = storedToken?.trim() || "";
    if (!token) return "";
    return token.startsWith(BEARER_PREFIX) ? token : `${BEARER_PREFIX}${token}`;
};

const decodeBase64Url = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    if (typeof atob !== "function") return "";
    return atob(padded);
};

export const isTokenExpired = (storedToken: string | null): boolean => {
    if (!storedToken) return true;
    const rawToken = storedToken.startsWith(BEARER_PREFIX)
        ? storedToken.slice(BEARER_PREFIX.length)
        : storedToken;
    const parts = rawToken.split(".");
    if (parts.length < 2) return true;
    try {
        const payload = JSON.parse(decodeBase64Url(parts[1]));
        if (typeof payload?.exp !== "number") return true;
        return Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
};

const extractRolesFromToken = (authorizationToken: string) => {
    const rawToken = authorizationToken.startsWith(BEARER_PREFIX)
        ? authorizationToken.slice(BEARER_PREFIX.length)
        : authorizationToken;

    const parts = rawToken.split(".");
    if (parts.length < 2) return [] as string[];

    try {
        const payload = JSON.parse(decodeBase64Url(parts[1]));
        if (!Array.isArray(payload?.roles)) return [] as string[];
        return payload.roles.filter((role: unknown): role is string => typeof role === "string");
    } catch {
        return [] as string[];
    }
};

export const useAuth = () => {
    const [token, setToken] = useState("");
    const [username, setUsername] = useState("");
    const [roles, setRoles] = useState<string[]>([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const t = formatAuthorizationToken(localStorage.getItem(TOKEN_STORAGE_KEY));
            const u = localStorage.getItem(USERNAME_STORAGE_KEY) || "";
            setToken(t);
            setUsername(u);
            setRoles(extractRolesFromToken(t));
            setIsReady(!!(t && u));
        }
    }, []);

    const isAdmin = roles.includes("ROLE_ADMIN");

    return { token, username, roles, isAdmin, isReady };
};
