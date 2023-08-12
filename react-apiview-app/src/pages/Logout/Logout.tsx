import React, {useState} from "react";


export default function Logout() {
    console.log('LOGOUT');
    localStorage.setItem("REACT-APP-MY-USERNAME", '')
    localStorage.setItem("REACT-APP-MY-TOKEN", '')
    window.location.reload()
}
