'use client';
import React, {useEffect, useState} from "react";

export default function Hello() {

    return (

        <div>
            <img src='../../vercel.svg' className="App-logo" alt="logo" style={{ height: 200, width: 200 }}/>
            <div className="login-ok">
                <h1 style={{color: 'green'}}>Hello {localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")}!</h1>
            </div>
            <div className="login-ok">
                <h1> Welcome to the home page</h1>
            </div>
        </div>
    )
}
