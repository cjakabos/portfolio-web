import logo from './pages/Stock/logo.svg';
import './App.css';
import Confirm from "./pages/Hello/Hello";
import React from "react";
import Hello from "./pages/Hello/Hello";
import Stock from "./pages/Stock/Stock";
import Login from "./pages/Login/Login";
import Item from "./pages/Item/Item";

import "./styles.css";
import { BrowserRouter,Routes, Route, RouteProps, Switch, Navigate } from "react-router-dom";
import Tabs from "./components/Tabs/Tabs";
import TabPanel from "./components/TabPanel/TabPanel";
import { tabLists } from "./data/tab-lists";
import { tabListsDefault } from "./data/tab-lists-default";
import { userState } from "./state/userState";
import {useRecoilValue} from "recoil";
import {Tab, TabList} from "react-tabs";

export default function App() {

    //const user = useRecoilValue(userState);

    const userToken = sessionStorage.getItem("token")

    if (userToken === null) {
        console.log(typeof(userToken?.toString()) !== 'undefined');
        console.log(typeof(userToken?.toString()) !== 'undefined');
        console.log(typeof(userToken?.toString()) !== 'undefined');

        return (
            <Tabs tabLists={tabListsDefault}>
                <Routes>
                    <Route component={Login} />
                    <Route path="signup" element={<Stock/>} />
                    <Route path="login" element={<Login/>} />
                    <Route path="item" element={<Item/>} />
                    <Route path="*" element={<Navigate to="signup" />} />
                </Routes>
            </Tabs>
        );

    }

    return (
        <Tabs tabLists={tabLists}>
            <Routes>
                <Route component={Login} />
                <Route path="signup" element={<Stock/>} />
                <Route path="login" element={<Login/>} />
                <Route
                    exact
                    path="home"
                    element={<Hello/>}
                />
                <Route path="item" element={<Item/>} />
                <Route path="*" element={<Navigate to="signup" />} />
            </Routes>
        </Tabs>
    );
}

