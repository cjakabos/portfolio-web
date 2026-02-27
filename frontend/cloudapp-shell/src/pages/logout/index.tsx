'use client';
import React, {useEffect} from "react";
import { useLogout } from "../../hooks/useLogout";


export default function Index() {
    const { logout } = useLogout();

    useEffect(() => {
        const runLogout = async () => {
            await logout();
            window.location.href = '/login';
        };

        void runLogout();
    }, [logout]);

    return <h1>Successfuly logout</h1>;
}
