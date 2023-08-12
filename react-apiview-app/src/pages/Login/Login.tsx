import React, {useState} from "react";
import axios from "axios";
import {Store, STORE_KEY} from "../../Store";
import {Link} from "react-router-dom";


const initialValues = {
    username: "",
    password: "",
    feedback: "defaultFeedback",
};

export default function Login(this: any) {

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


        axios.post('http://localhost:8099/login', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                //get token from response
                const token = response.headers.authorization;

                //set JWT token to local
                localStorage.setItem("REACT-APP-MY-TOKEN", token);

                setLoginFeedback("OK")
                localStorage.setItem("REACT-APP-MY-USERNAME", postData.username)

                Store.setValue(STORE_KEY.USERTOKEN, token);

                window.location.reload()

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
                        <input className="login-submit" id="loginButton" type="submit" value="Submit"/>
                        <div>
                            <h1 style={{color: 'red'}}>{("New user?")} <Link to="/signup"> Signup </Link></h1>
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
