'use client';
import React, {useState} from "react";
import {Navigate} from "react-router-dom";


export default function Logout() {
    console.log('LOGOUT');
    localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", '')
    localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", '')

    //window.location.reload()
    return (
        <Navigate to="home"/>
    );
}

