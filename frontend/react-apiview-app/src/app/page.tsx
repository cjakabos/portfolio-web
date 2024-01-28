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

    const authedRoutes = (
        <>
            <Link href="/home" onClick={() => navigate("/home")} style={{ color: "green" }}>Home</Link>
            <Link href="/shop" onClick={() => navigate("/shop")}>Shop</Link>
            <Link href="/pet" onClick={() => navigate("/pet")}>PetStore</Link>
            <Link href="/openmaps" onClick={() => navigate("/openmaps")}>OpenMaps</Link>
            <Link href="/openai" onClick={() => navigate("/openai")}>OpenAI</Link>
            <Link href="/jira" onClick={() => navigate("/jira")}>Jira</Link>
            <Link href="/mlops" onClick={() => navigate("/mlops")}>MLOps</Link>
            <Link href="/logout" onClick={() => navigate("/logout")} style={{ color: "red" }}>Logout</Link>
        </>
    );


    return (
        <>
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
