'use client';
import React, {useState} from "react";
import axios from "axios";
//import {Store, STORE_KEY} from "@/Store";
import {useRouter} from "next/navigation";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Image from "next/image";
import imgLogo from "../../../public/drawing.svg";




const initialValues = {
    username: "",
    password: "",
    feedback: "defaultFeedback",
};

export default function Index() {

    const router = useRouter()

    const [values, setValues] = useState(initialValues);
    const [Username, setUsername] = useState("")
    const [LoginFeedback, setLoginFeedback] = useState("")

    const handleChange = (event: { target: any }) => {
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };

    const handleClick = (event: { preventDefault: () => void; }) => {
        event.preventDefault();

        // 👇️ value of input field
        //console.log('handleClick 👉️', values);
        //values.feedback = useThisApi()
    };

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        var postData = {
            username: values.username,
            password: values.password
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };


        axios.post('http://localhost:80/cloudapp/user/user-login', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                //get token from response
                const token = response.headers.authorization;

                try {
                    if (typeof window !== "undefined") {
                        localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", postData.username)
                        //set JWT token to local
                        localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", token);

                        setLoginFeedback("OK")
                        router.push("/home")
                        window.location.reload()
                    }
                } catch (error) {
                    console.log(error)
                }

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
                setLoginFeedback("ERROR")
            })

    };

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
                <form onSubmit={handleSubmit}>
                    <table>
                        <tbody>
                        <tr>
                            <th>Username</th>
                            <td>
                                <input
                                    type="text"
                                    name="username"
                                    id="inputUsername"
                                    placeholder="Enter Username"
                                    onChange={handleChange}
                                    value={values.username}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>Password</th>
                            <td>
                                <input
                                    type="password"
                                    name="password"
                                    id="inputPassword"
                                    placeholder="Enter Password"
                                    onChange={handleChange}
                                    value={values.password}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        <tr>
                            <th></th>
                            <td>
                                <input className="submitbutton" id="loginButton" type="submit"
                                       value="Submit"/>
                                <div>
                                    <button className="menubutton"
                                            onClick={() => router.push("/register")}>
                                        <h1 style={{color: 'red'}}>{("New user?")} Signup </h1>
                                    </button>
                                </div>
                                <div className="login-error">
                                    {LoginFeedback === 'ERROR' &&
                                        <h1 style={{color: 'red'}}>{("Something went wrong")}</h1>}
                                </div>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </form>
            </div>
        </div>
    )
}
