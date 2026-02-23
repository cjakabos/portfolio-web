'use client';
import React, {useEffect} from "react";
import {useRouter} from "next/router";
import { useLogout } from "../../hooks/useLogout";


export default function Index() {
    const router = useRouter()
    const { logout } = useLogout();

    useEffect(() => {
        const runLogout = async () => {
            await logout();
            router.push('/');
            if (typeof window !== "undefined") {
                window.location.reload();
            }
        };

        void runLogout();
    }, [logout, router]);

    return <h1>Successfuly logout</h1>;
}
