"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {usePathname, useRouter} from "next/navigation";

const Header = () => {
    const router = useRouter()

    const [userToken, setUserToken] = useState('');

    useEffect(() => {
        // This code now safely runs only on the client side
        const token = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '';
        setUserToken(token);
    }, []);

    const handleClick=(e)=>{
        e.preventDefault();
        //e.target.style.background = 'red'
        //console.log(e.target);
        router.push("/home")
    }

    const authedRoutes = (
        <>
            <Link href="/home" onClick={() => router.push("/home")} style={{ color: "green" }}>Home</Link>
            <Link href="/shop" onClick={() => router.push("/shop")}>Shop</Link>
            <Link href="/petstore" onClick={() => router.push("/petstore")}>PetStore</Link>
            <Link href="/openmaps" onClick={() => router.push("/openmaps")}>📌 OpenMaps 📌</Link>
            <Link href="/openai" onClick={() => router.push("/openai")}>OpenAI</Link>
            <Link href="/jira" onClick={() => router.push("/jira")}>Jira</Link>
            <Link href="/mlops" onClick={() => router.push("/mlops")}>MLOps</Link>
            <Link href="/notefile" onClick={() => router.push("/notefile")}>Notes and Files</Link>
            <Link href="/chat" onClick={() => router.push("/chat")}>Chat</Link>
            <Link href="/logout" onClick={() => router.push("/logout")} style={{ color: "red" }}>Logout</Link>
        </>
    );


    return (
        <>
            <nav
                // z-index 1001 is needed because of leaflet GeoMap
                className="
                  fixed
                  left-0
                  top-0
                  z-[1001]
                  h-16
                  w-screen
                  bg-white
                  border-b-[0.5px]
                  border-neutral-200
                  dark:border-neutral-700
                  dark:bg-neutral-100-dark
                  "
            >
                <div className="container mx-auto flex items-center justify-between h-24">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <Link href="/stock" onClick={() => router.push("/stock")}>Signup</Link>
                                <Link href="/login" onClick={() => router.push("/login")}>Login</Link>
                            </>
                        ) :
                        <>
                            {authedRoutes}
                        </>
                    }
                </div>
            </nav>
        </>
    );
};

export default Header;