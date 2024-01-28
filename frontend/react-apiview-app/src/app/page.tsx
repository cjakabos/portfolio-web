'use client';
import Image from 'next/image'
import Link from 'next/link';
import React, {useEffect, useState} from "react";
import {BrowserRouter, Routes, Route, Navigate, useNavigate} from "react-router-dom";
import { RecoilRoot } from "recoil";
import {MLOps} from "../pages/MLOps/MLOps";
import Login from "@/pages/Login/Login";
import Hello from "@/pages/Hello/Hello";
import Stock from "@/pages/Stock/Stock";
import Shop from "@/pages/Shop/Shop";
import OpenAI from "@/pages/OpenAI/OpenAI";
import PetStore from "@/pages/PetStore/PetStore";
import Jira from "@/pages/Jira/Jira";
import Logout from "@/pages/Logout/Logout";
import OpenMaps from "@/pages/OpenMaps/OpenMaps";

function NavBar ()  {
    const navigate = useNavigate();
    //const session = useAppSelector(selectSession);
    //const history = useHistory();
    //const dispatch = useAppDispatch();
    //const doLogout = () => dispatch(logout(history));

    try {
        var userToken = (localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
    } catch (error) {
        console.log(error)
    }

    const handleClick=(e)=>{
        e.preventDefault();
        //e.target.style.background = 'red'
        //console.log(e.target);
        navigate("/home")
    }

    const authedRoutes = (
        <>
            <button className="menubutton" onClick={handleClick}>
                Home
            </button>
            <button className="menubutton" onClick={() => navigate("/shop")}>
                Shop
            </button>
            <button className="menubutton" onClick={() => navigate("/pet")}>
                PetStore
            </button>
            <button className="menubutton" onClick={() => navigate("/openmaps")}>
                📌 OpenMaps 📌
            </button>
            <button className="menubutton" onClick={() => navigate("/openai")}>
                OpenAI
            </button>
            <button className="menubutton" onClick={() => navigate("/jira")}>
                Jira
            </button>
            <button className="menubutton" onClick={() => navigate("/mlops")}>
                MLOps
            </button>
            <button className="popup-close" onClick={() => navigate("/logout")}>
                Logout
            </button>
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
                        <Link href="/signup" onClick={() => navigate("/signup")}>Sign Up</Link>
                        <Link href="/login" onClick={() => navigate("/login")}>Login</Link>
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
}
export default function Home() {

    try {
        var userToken = (localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
    } catch (error) {
        console.log(error)
    }

    return (
        <>
            <RecoilRoot>
                <BrowserRouter>
                    <NavBar />
                    <Routes>
                        {(userToken === null || userToken === '') ? (
                                <>
                                    <Route path="signup" element={<Stock/>}/>
                                    <Route path="login" element={<Login/>}/>
                                    <Route path="*" element={<Login/>}/>
                                </>
                            ) :
                            <>
                                <Route path="home" element={<Hello/>}/>
                                <Route path="shop" element={<Shop/>}/>
                                <Route path="pet" element={<PetStore/>}/>
                                <Route path="openmaps" element={<OpenMaps/>}/>
                                <Route path="openai" element={<OpenAI/>}/>
                                <Route path="jira" element={<Jira/>}/>
                                <Route path="mlops" element={<MLOps/>}/>
                                <Route path="logout" element={<Logout/>}/>
                                <Route path="*" element={<Navigate to="home"/>}/>
                            </>
                        }
                    </Routes>
                </BrowserRouter>
            </RecoilRoot>
        </>
    );
}
