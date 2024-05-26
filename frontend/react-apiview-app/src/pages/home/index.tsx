'use client';
import React, {useEffect, useRef, useState} from "react";

export default function Index() {

    const [username, setUsername] = useState('');

    //Make sure useEffect only runs once
    const effectRan = useRef(false);
    // @ts-ignore
    useEffect(() => {
        if (!effectRan.current) {
            try {
                setUsername(localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || '')
                console.log('this is the username1: ', username)
            } catch (error) {
                console.log(error)
            }
        }
        return () => effectRan.current = true;
    }, []);

    console.log(username)
    return (
        <div>
            <div className="flex items-center justify-center">
                <img src='../../drawing.svg' className="App-logo" alt="logo"
                     style={{height: 200, width: 200}}/>
            </div>
            <div className="login-ok">
                <h1 style={{color: 'green'}}>Hello {username}!</h1>
            </div>
            <div className="login-ok">
                <h1> Welcome to the home page</h1>
            </div>
        </div>
    )
}
