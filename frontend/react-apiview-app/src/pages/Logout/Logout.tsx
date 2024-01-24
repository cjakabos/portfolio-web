'use client';
import React, {useEffect, useState} from "react";
import {Navigate, useNavigate} from "react-router-dom";


export default function Logout() {
    const navigate = useNavigate();

    useEffect(() => {
        console.log('LOGOUT');
        localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", '')
        localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", '')
        navigate("/login")
        navigate(0)
    }, []);
}

