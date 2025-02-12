import {useRouter} from "next/navigation";
import Link from "next/link";
import React, {useEffect, useState} from 'react'
import { motion } from "framer-motion";
import SwitchTheme from "@/components/switch-theme";
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LoginIcon from '@mui/icons-material/Login';
import HomeIcon from '@mui/icons-material/Home';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PetsIcon from '@mui/icons-material/Pets';
import MapIcon from '@mui/icons-material/Map';
import AssistantIcon from '@mui/icons-material/Assistant';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import LogoutIcon from '@mui/icons-material/Logout';

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
            <Link className="order-1 flex lg:order-none w-[100px]" href="/home">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <HomeIcon fontSize="medium" /> Home
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <HomeIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/shop">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <ShoppingCartIcon fontSize="medium" /> Shop
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <ShoppingCartIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/petstore">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <PetsIcon fontSize="medium" /> Pets
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <PetsIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/maps">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <MapIcon fontSize="medium" /> Maps
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <MapIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/chatllm">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <AssistantIcon fontSize="medium" /> GPT
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <AssistantIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/jira">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <ChecklistIcon fontSize="medium" /> Jira
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <ChecklistIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/mlops">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <TrendingUpIcon fontSize="medium" /> MLOps
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <TrendingUpIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/notefile">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <AttachFileIcon fontSize="medium" /> Files
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <AttachFileIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/chat">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <MarkUnreadChatAltIcon fontSize="medium" /> Chat
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <MarkUnreadChatAltIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="order-1 flex lg:order-none w-[100px]" href="/logout">
                <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                    <LogoutIcon fontSize="medium" /> Logout
                </button>
                <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                    <LogoutIcon fontSize="medium" />
                </div>
            </Link>
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
                <aside className="top-0 z-40 flex h-[80px] text-2xl lg:sticky centered">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <Link className="order-1 flex lg:order-none w-[100px]" href="/register">
                                    <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                                        <HowToRegIcon fontSize="medium" /> Register
                                    </button>
                                    <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                                        <HowToRegIcon fontSize="medium" />
                                    </div>
                                </Link>
                                <Link className="order-1 flex lg:order-none w-[100px]" href="/login">
                                    <button className="ml-10 hidden self-center  opacity-70 hover:opacity-100 lg:block">
                                        <LoginIcon fontSize="medium" /> Login
                                    </button>
                                    <div className="ml-4 self-center hover:text-teal-500 lg:hidden">
                                        <LoginIcon fontSize="medium" />
                                    </div>
                                </Link>
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