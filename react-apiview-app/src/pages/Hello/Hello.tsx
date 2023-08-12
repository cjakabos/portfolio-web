import React, {useEffect, useState} from "react";

export default function Hello() {

    return (

        <div>
            <img src='/logo.svg' className="App-logo" alt="logo"/>
            <div className="login-ok">
                <h1 style={{color: 'green'}}>Hello {localStorage.getItem("REACT-APP-MY-USERNAME")}!</h1>
            </div>
            <div className="login-ok">
                <h1> Welcome to the home page</h1>
            </div>
        </div>
    )
}
