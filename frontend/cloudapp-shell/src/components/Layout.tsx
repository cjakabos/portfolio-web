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

    let token = 'placeholder';

    useEffect(() => {
        if (typeof window !== "undefined") {
            token = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '';
            setUserToken(token);
            if (token === '') {
                router.push("/");
            }
        }
    }, []);

    const authedRoutes = (
        <>
            <Button className="menuButton" style={{ color: "green" }} onClick={() => router.push("/home")}>
                Home
            </Button>
            <Button className="menuButton" onClick={() => router.push("/shop")}>
                Shop
            </Button>
            <Button className="menuButton" onClick={() => router.push("/petstore")}>
                PetStore
            </Button>
            <Button className="menuButton" onClick={() => router.push("/maps")}>
                Maps
            </Button>
            <Button className="menuButton" onClick={() => router.push("/jira")}>
                Jira
            </Button>
            <Button className="menuButton" onClick={() => router.push("/mlops")}>
                MLOps
            </Button>
            <Button className="menuButton" onClick={() => router.push("/notefile")}>
                Files
            </Button>
            <Button className="menuButton" onClick={() => router.push("/chat")}>
                Chat
            </Button>
            <Button className="menuButton" style={{ color: "red" }} onClick={() => router.push("/logout")}>
                Logout
            </Button>
        </>
    );


    return (
        <>
            <motion.main
                initial={{opacity: 0, y: -15}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0}}
                transition={{duration: 0.5}}
                className="min-h-[100vh] flex-col m-auto lg:flex "
            >
                <aside className="z-[1001] px-4 pb-4 pt-2 gap-10  lg:sticky top-0 bg-white dark:bg-black centered">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <Button className="menuButton" onClick={() => router.push("/register")}>
                                    Register
                                </Button>
                                <Button className="menuButton" onClick={() => router.push("/login")}>
                                    Login
                                </Button>
                            </>
                        ) :
                        <>
                            {authedRoutes}
                        </>
                    }
                    <SwitchTheme></SwitchTheme>
                </aside>
                <section className="px-4 pb-4 pt-6 flex items-center justify-center flex-col">
                    {children}
                </section>
            </motion.main>
        </>
    )
}

export default Layout;