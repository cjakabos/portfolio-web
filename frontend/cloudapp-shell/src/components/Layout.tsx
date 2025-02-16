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
            <Link className="layoutLinksFormat" href="/home">
                <button className="layoutLinksButtonFormat">
                    <HomeIcon fontSize="medium" /> Home
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <HomeIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/shop">
                <button className="layoutLinksButtonFormat">
                    <ShoppingCartIcon fontSize="medium" /> Shop
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <ShoppingCartIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/petstore">
                <button className="layoutLinksButtonFormat">
                    <PetsIcon fontSize="medium" /> Pets
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <PetsIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/maps">
                <button className="layoutLinksButtonFormat">
                    <MapIcon fontSize="medium" /> Maps
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <MapIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/chatllm">
                <button className="layoutLinksButtonFormat">
                    <AssistantIcon fontSize="medium" /> GPT
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <AssistantIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/jira">
                <button className="layoutLinksButtonFormat">
                    <ChecklistIcon fontSize="medium" /> Jira
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <ChecklistIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/mlops">
                <button className="layoutLinksButtonFormat">
                    <TrendingUpIcon fontSize="medium" /> MLOps
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <TrendingUpIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/notefile">
                <button className="layoutLinksButtonFormat">
                    <AttachFileIcon fontSize="medium" /> Files
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <AttachFileIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/chat">
                <button className="layoutLinksButtonFormat">
                    <MarkUnreadChatAltIcon fontSize="medium" /> Chat
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <MarkUnreadChatAltIcon fontSize="medium" />
                </div>
            </Link>
            <Link className="layoutLinksFormat" href="/logout">
                <button className="layoutLinksButtonFormat">
                    <LogoutIcon fontSize="medium" /> Logout
                </button>
                <div className="layoutLinksButtonOnlyFormat">
                    <LogoutIcon fontSize="medium" />
                </div>
            </Link>
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
                <aside className="sticky top-0 z-40 flex justify-center h-[80px] w-full text-2xl lg:sticky bg-white dark:bg-black">
                    {(userToken === null || userToken === '') ? (
                            <>
                                <Link className="layoutLinksFormat" href="/register">
                                    <button className="layoutLinksButtonFormat">
                                        <HowToRegIcon fontSize="medium" /> Register
                                    </button>
                                    <div className="layoutLinksButtonOnlyFormat">
                                        <HowToRegIcon fontSize="medium" />
                                    </div>
                                </Link>
                                <Link className="layoutLinksFormat" href="/login">
                                    <button className="layoutLinksButtonFormat">
                                        <LoginIcon fontSize="medium" /> Login
                                    </button>
                                    <div className="layoutLinksButtonOnlyFormat">
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