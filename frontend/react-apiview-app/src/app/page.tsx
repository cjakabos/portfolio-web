'use client';
import dynamic from "next/dynamic";
import React, {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";

const Login = dynamic(() => import("@/components/login/Login"), {
    ssr: false,
    suspense: true,
    loading: () => <p>Loading...</p>
});
const Hello = dynamic(() => import("@/components/hello/Hello"), {
    ssr: false,
    suspense: true,
    loading: () => <p>Loading...</p>
});



function NavBar ()  {

}
export default function Home() {

    const [userToken, setUserToken] = useState('');

    useEffect(() => {
        // This code now safely runs only on the client side
        const token = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '';
        setUserToken(token);
    }, []);

    return (
        <div className="App">
            <main className="h-screen flex flex-col bg-darkBlue-900">
                {(userToken === null || userToken === '') ? (
                        <>
                            <Login/>
                        </>
                    ) :
                    <>
                        <Hello/>
                    </>
                }
            </main>
        </div>
    );

}
