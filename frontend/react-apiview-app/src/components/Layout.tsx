import Image from 'next/image'
import Link from 'next/link'
import {useRouter} from "next/navigation";
import React, {useEffect, useState} from 'react'
import { motion } from "framer-motion";
import {Button} from "@mui/material";
import SwitchTheme from "@/components/switch-theme";

const Layout = ({
                             children,
                         }: {
    children: React.ReactNode;
}) => {

    const router = useRouter();

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
            <motion.main
                initial={{opacity: 0, y: -15}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0}}
                transition={{duration: 0.5}}
                className="min-h-[100vh] flex-col m-auto lg:flex"
            >
                <aside className="min-h-[10vh] p-4 flex flex-row gap-10 lg:sticky top-4 h-20">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <Link href="/register" onClick={() => router.push("/hom")}>Signup</Link>
                                <Link href="/login" onClick={() => router.push("/")}>Login</Link>
                            </>
                        ) :
                        <>
                            {authedRoutes}
                        </>
                    }
                    <SwitchTheme></SwitchTheme>
                </aside>
                <section className="px-4 pb-4 pt-6">
                    {children}
                </section>
            </motion.main>
        </>
    )
}

export default Layout;