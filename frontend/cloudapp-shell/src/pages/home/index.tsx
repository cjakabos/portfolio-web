'use client';
import React, {useEffect, useRef, useState} from "react";
import Image from "next/image";
import imgLogo from "../../../public/drawing.svg";


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
                <Image
                    src={imgLogo}
                    width={200}
                    height={200}
                    alt="Logo"
                    className="dark:invert mb-6 transition ease-in-out duration-300 hover:transform hover:scale-105 cursor-pointer"
                    quality={100}
                />
            </div>
            <div className="flex items-center justify-center">
                <h1 style={{color: 'green'}}>{username} </h1>
                <h1>, welcome to the home page!</h1>
            </div>
        </div>
    )
}
