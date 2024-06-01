'use client'
import React, {useEffect, useState} from "react";
import axios from "axios";
import {useRouter} from "next/navigation";
import Image from "next/image";
import imgLogo from "../../../public/drawing.svg";

const initialValues = {
    username: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    feedback: "defaultFeedback",
};
export default function Index() {

    const [values, setValues] = useState(initialValues);
    const [Name, setName] = useState("")
    const [Feedback, setFeedback] = useState("")

    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };

    const handleClick = (event: { preventDefault: () => void; }) => {
        event.preventDefault();

        // 👇️ value of input field
        console.log('handleClick 👉️', values);
        //values.feedback = useThisApi()
    };
    /*    useEffect(() => {
            Axios.get('https://api.adviceslip.com/advice')
                .then(response => {
                    setName(response.data.slip.advice)
                })
        }, [Name]) // useEffect will trigger whenever Name is different.*/
    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        if (values.password === values.confirmPassword) {
            var postData = {
                firstname: values.firstname,
                lastname: values.lastname,
                username: values.username,
                password: values.password,
                confirmPassword: values.confirmPassword
            };

            let axiosConfig = {
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                }
            };

            axios.post('http://localhost:80/cloudapp/user/user-register', postData, axiosConfig)
                .then((response) => {
                    console.log("RESPONSE RECEIVED: ", response);

                    setFeedback("OK")
                    router.push("/login")
                    //setName(response.data);
                })
                .catch((error) => {
                    console.log("AXIOS ERROR: ", error.response);
                    //setName(error.response);
                    setFeedback("ERROR")
                })
        } else {
            setFeedback("PASSWORDERROR")
        }

    };

    /*    useEffect(() => {

        const firstname = values.firstname;
        const lastname = values.lastname;
        const username = values.username;
        const password = values.password;

        Axios.post("", {
            firstname: firstname,
            lastname: lastname,
            username: username,
            password: password
            })
            .then(response => {
                setName(response.data.firstname)
            })
    }, [Name]) // useEffect will trigger whenever Name is different.*/

    const router = useRouter()

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
                            <th>First name</th>
                            <td>
                                <input
                                    type="text"
                                    name="firstname"
                                    id="firstname"
                                    placeholder="Enter First Name"
                                    onChange={handleChange}
                                    value={values.firstname}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>Last name</th>
                            <td>
                                <input
                                    type="text"
                                    name="lastname"
                                    id="lastname"
                                    placeholder="Enter Last Name"
                                    onChange={handleChange}
                                    value={values.lastname}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>Username</th>
                            <td>
                                <input
                                    type="text"
                                    name="username"
                                    id="username"
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
                                    id="password"
                                    placeholder="Enter Password"
                                    onChange={handleChange}
                                    value={values.password}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        <tr>
                            <th>Confirm password</th>
                            <td>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    id="confirmPassword"
                                    placeholder="Confirm Password"
                                    onChange={handleChange}
                                    value={values.confirmPassword}
                                    maxLength={20}
                                    required
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    {/*<h2>Username: {values.username} and Password: {values.password} and feedback is: {Name}</h2>*/}
                    {/*   onClick={() => functionName()}                        */}
                    {/* <input id="loginButton" type="submit" value="Submit" onClick={e => setName("test")}/>*/}
                    <div className="flex items-center justify-center">
                        <input className="submitbutton" type="submit" value="Submit"/>
                    </div>
                </form>

            </div>
            <div className="flex items-center justify-center">
                <div className="login-top">
                    {Feedback === 'ERROR' && <h1 style={{color: 'red'}}>{("Something went wrong")}</h1>}
                </div>
                {Feedback === 'PASSWORDERROR' &&
                    <h1 style={{color: 'red'}}>{("Passwords do not mach")}</h1>}
            </div>
        </div>
    )
}
