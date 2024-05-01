'use client';
import React, {useState} from "react";
import axios from "axios";
//import {Store, STORE_KEY} from "@/Store";
import {useRouter} from "next/navigation";



const initialValues = {
    username: "",
    password: "",
    feedback: "defaultFeedback",
};

export default function Login() {

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
        <section>
            <article>
                <div>
                    <div className="login-top">
                        <h1>{("Sign in")}</h1>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Username:
                            <input
                                type="username"
                                name="username"
                                id="inputUsername"
                                placeholder="Enter Username"
                                onChange={handleChange}
                                value={values.username}
                                maxLength={20}
                                required
                            />
                        </label>
                        <label>
                            Password:
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
                        </label>
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        <div>
                            <button className="menubutton" onClick={() => router.push("/stock")}>
                                <h1 style={{color: 'red'}}>{("New user?")} Signup </h1>
                            </button>
                        </div>
                        <div className="login-error">
                            {LoginFeedback === 'ERROR' && <h1 style={{color: 'red'}}>{("Something went wrong")}</h1>}
                        </div>
                    </form>
                </div>
            </article>
        </section>
    )
}
