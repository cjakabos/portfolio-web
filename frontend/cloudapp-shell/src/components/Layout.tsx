"use client"
import {useRouter} from "next/navigation";
import React, {useEffect, useState} from 'react'
import { motion } from "framer-motion";
import SwitchTheme from "@/components/switch-theme";
import {
    HowToReg,
    Login,
    Home,
    ShoppingCart,
    Pets,
    Map,
    Assistant,
    TrendingUp,
    Checklist,
    AttachFile,
    MarkUnreadChatAlt,
    Logout,
} from '@mui/icons-material';

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
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/home")}>
                    <Home fontSize="medium" style={{ color: 'white' }} />  Home
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/home")}>
                    <Home fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/shop")}>
                    <ShoppingCart fontSize="medium" style={{ color: 'white' }} />  Shop
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/shop")}>
                    <ShoppingCart fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/petstore")}>
                    <Pets fontSize="medium" style={{ color: 'white' }} />  Pets
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/petstore")}>
                    <Pets fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/maps")}>
                    <Map fontSize="medium" style={{ color: 'white' }} />  Maps
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/maps")}>
                    <Map fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/chatllm")}>
                    <Assistant fontSize="medium" style={{ color: 'white' }} />  GPT
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/chatllm")}>
                    <Assistant fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/jira")}>
                    <Checklist fontSize="medium" style={{ color: 'white' }} />  Jira
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/jira")}>
                    <Checklist fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/mlops")}>
                    <TrendingUp fontSize="medium" style={{ color: 'white' }} />  MLOps
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/mlops")}>
                    <TrendingUp fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/notefile")}>
                    <AttachFile fontSize="medium" style={{ color: 'white' }} />  Files
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/notefile")}>
                    <AttachFile fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/chat")}>
                    <MarkUnreadChatAlt fontSize="medium" style={{ color: 'white' }} />  Chat
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/chat")}>
                    <MarkUnreadChatAlt fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
            <div className="layoutLinksFormat">
                <button className="layoutLinksButtonFormat" onClick={()=> router.push("/logout")}>
                    <Logout fontSize="medium" style={{ color: 'white' }} />  Logout
                </button>
                <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/logout")}>
                    <Logout fontSize="medium" style={{ color: 'white' }} /> 
                </div>
            </div>
        </>
    );
    //<aside className="z-[1001] px-4 pb-4 pt-2 gap-10">

    return (
        <>
            <motion.main
                initial={{opacity: 0, y: -15}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0}}
                transition={{duration: 0.5}}
                className="min-h-[100vh] flex-col m-auto lg:flex"
            >
                <aside className="sticky top-0 z-40 flex justify-center h-[80px] w-full text-2xl lg:sticky bg-black dark:bg-black">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <div className="layoutLinksFormat">
                                    <button className="layoutLinksButtonFormat" onClick={()=> router.push("/register")}>
                                        <HowToReg fontSize="medium" style={{ color: 'white' }} />  Register
                                    </button>
                                    <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/register")}>
                                        <HowToReg fontSize="medium" style={{ color: 'white' }} /> 
                                    </div>
                                </div>
                                <div className="layoutLinksFormat">
                                    <button className="layoutLinksButtonFormat" onClick={()=> router.push("/login")}>
                                        <Login fontSize="medium" style={{ color: 'white' }} />  Login
                                    </button>
                                    <div className="layoutLinksButtonOnlyFormat" onClick={()=> router.push("/login")}>
                                        <Login fontSize="medium" style={{ color: 'white' }} /> 
                                    </div>
                                </div>
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