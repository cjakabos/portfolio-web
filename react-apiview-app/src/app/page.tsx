'use client';
import Image from 'next/image'
import React, {useEffect, useState} from "react";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import { RecoilRoot } from "recoil";
import {MLOps} from "../pages/MLOps/MLOps";
import Tabs from "../components/Tabs/Tabs";
import {tabLists} from "../data/tab-lists";
import {tabListsDefault} from "../data/tab-lists-default";
import Login from "@/pages/Login/Login";
import Hello from "@/pages/Hello/Hello";
import Stock from "@/pages/Stock/Stock";
import Shop from "@/pages/Shop/Shop";
import OpenAI from "@/pages/OpenAI/OpenAI";
import PetStore from "@/pages/PetStore/PetStore";
import Jira from "@/pages/Jira/Jira";
import Map from "@/pages/Map/Map";
import Logout from "@/pages/Logout/Logout";
import USMap from "@/pages/USMap/us-map";
import KoreaBubbleMap, {KoreaMapData} from "@/pages/InteractiveMap/KoreaBubbleMap";

const data: KoreaMapData = {
    sido: [{ code: "1100000000", name: "Seoul", count: 400 }],
    sigungu: [
        { code: "1168000000", name: "Gangnam-gu district", count: 300 },
        { code: "1171000000", name: "Songpa-gu district", count: 100 },
    ],
    emd: [
        { code: "1168010100", name: "Yeoksam-dong ward", count: 300 },
        { code: "1171010100", name: "Jamsil-dong ward", count: 100 },
    ],
};
export default function Home() {

    // Set the value received from the local storage to a local state
    const [token, setToken] = useState("")

    var userToken = '';

    useEffect(() => {
        userToken = (localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
        setToken(userToken)
        console.log("test0: ", userToken);
    }, []);


    if (token === null || token === '') {
        console.log("test: ", token);

        return (
            <BrowserRouter>
                    <Tabs tabLists={tabListsDefault}>
                    <Routes>
                        <Route path="signup" element={<Stock/>}/>
                        <Route path="login" element={<Login/>}/>
                        <Route path="*" element={<Login/>}/>
                    </Routes>
                </Tabs>
            </BrowserRouter>
        );

    }
    console.log("test2: ", token);
    return (
        <RecoilRoot>
            <BrowserRouter>
                <Tabs tabLists={tabLists}>
                    <Routes>
                        <Route
                            path="home"
                            element={<Hello/>}
                        />
                        <Route path="shop" element={<Shop/>}/>
                        <Route path="pet" element={<PetStore/>}/>
                        <Route path="map" element={<Map/>}/>
                        <Route path="usmap" element={<USMap/>}/>
                        <Route path="koreamap" element={<KoreaBubbleMap width={1000} height={1000} data={data}/>}/>
                        <Route path="openai" element={<OpenAI/>}/>
                        <Route path="jira" element={<Jira/>}/>
                        <Route path="mlops" element={<MLOps/>}/>
                        <Route path="logout" element={<Logout/>}/>
                        <Route path="*" element={<Navigate to="home"/>}/>
                    </Routes>
                </Tabs>
            </BrowserRouter>
        </RecoilRoot>
    );
}
