import React, { FC, useRef, useId, useEffect,useState } from "react";
import axios from "axios";

const initialValues = {
    username: "",
    password: "",
    feedback: "defaultFeedback",
};

export default function Login(this: any) {

    const [values, setValues] = useState(initialValues);
    const [Name, setName] = useState("")

    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
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

        // try {
        //     const data = {username: values.username, password: values.password};
        //     fetch('http://localhost:8099/login', {
        //         method: 'POST',
        //         headers: {
        //             'Accept': 'application/json',
        //             'Content-Type': 'application/json',
        //         },
        //         body: JSON.stringify(data)
        //     }).then(function(response) {
        //         console.log(response.headers.get("Authorization"));
        //     }).then(function(data) {
        //         console.log(data);
        //     })
        // } catch (e) {
        //     console.log(e);
        // }

        axios.post('http://localhost:8099/login', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response);
                //get token from response
                const token  =  response.headers.authorization;

                //set JWT token to local
                localStorage.setItem("token", token);

                //setName(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
                //setName(error.response);
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
                            <input id="loginButton" type="submit" value="Submit"/>
                        </form>
                  </div>
                </article>
            </section>
    )
}
