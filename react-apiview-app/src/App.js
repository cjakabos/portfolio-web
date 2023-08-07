import './App.css';
import React from "react";
import Hello from "./pages/Hello/Hello";
import Stock from "./pages/Stock/Stock";
import Login from "./pages/Login/Login";
import Item from "./pages/Item/Item";
import Map from "./pages/Map/Map";

import "./styles.css";
import { Routes, Route, Navigate } from "react-router-dom";
import Tabs from "./components/Tabs/Tabs";
import { tabLists } from "./data/tab-lists";
import { tabListsDefault } from "./data/tab-lists-default";
import Logout from "./pages/Logout/Logout";

export default function App() {

    const userToken = localStorage.getItem("REACT-APP-MY-TOKEN")

    if (userToken === null || userToken === '') {
        console.log(typeof(userToken?.toString()) !== 'undefined');
        console.log(typeof(userToken?.toString()) !== 'undefined');
        console.log(typeof(userToken?.toString()) !== 'undefined');

        return (
            <Tabs tabLists={tabListsDefault}>
                <Routes>
                    <Route component={Login} />
                    <Route path="signup" element={<Stock/>} />
                    <Route path="login" element={<Login/>} />
                    <Route path="*" element={<Navigate to="login" />} />
                </Routes>
            </Tabs>
        );

    }

    return (
        <Tabs tabLists={tabLists}>
            <Routes>
                <Route
                    exact
                    path="home"
                    element={<Hello/>}
                />
                <Route path="item" element={<Item/>} />
                <Route path="map" element={<Map/>} />
                <Route path="logout" element={<Logout/>} />
                <Route path="*" element={<Navigate to="home" />} />
            </Routes>
        </Tabs>
    );
}

