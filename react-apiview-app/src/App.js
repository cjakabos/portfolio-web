import logo from './pages/Stock/logo.svg';
import './App.css';
import Confirm from "./pages/Hello/Hello";
import React from "react";
import Hello from "./pages/Hello/Hello";
import Stock from "./pages/Stock/Stock";

import "./styles.css";
import { Routes, Route, Navigate } from "react-router-dom";
import Tabs from "./components/Tabs/Tabs";
import TabPanel from "./components/TabPanel/TabPanel";
import { tabLists } from "./data/tab-lists";

export default function App() {
    return (
        <Tabs tabLists={tabLists}>
            <Routes>
                <Route path="signup" element={<Stock/>} />
                <Route path="login" element={<Hello/>} />
                <Route path="home" element={<Hello/>} />
                <Route path="*" element={<Navigate to="signup" />} />
            </Routes>
        </Tabs>
    );
}

function activeContent(route) {
    return <Hello/>
}

