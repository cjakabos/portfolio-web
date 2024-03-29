import React, {useEffect, useState} from "react";
import axios from "axios";
import {Link, useNavigate} from "react-router-dom";

const initialValues = {
    username: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    feedback: "defaultFeedback",
};
export default function Stock() {

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

            axios.post('http://localhost:8099/api/user/create', postData, axiosConfig)
                .then((response) => {
                    console.log("RESPONSE RECEIVED: ", response);

                    setFeedback("OK")
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

    const navigate = useNavigate();

    return (
        <div>
            <img src='../../vercel.svg' className="App-logo" alt="logo" style={{ height: 200, width: 200 }}/>
            <section>
                <article>
                    <div>

                            <div className="login-top">
                                {Feedback !== 'OK' ? (
                                    <>
                                        <div className="flex items-center justify-center">
                                            <h1>{("Sign up")}</h1>
                                        </div>
                                        <form onSubmit={handleSubmit}>
                                            <table>
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
                                                            type="username"
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
                                            </table>
                                            {/*<h2>Username: {values.username} and Password: {values.password} and feedback is: {Name}</h2>*/}
                                            {/*   onClick={() => functionName()}                        */}
                                            {/* <input id="loginButton" type="submit" value="Submit" onClick={e => setName("test")}/>*/}
                                            <div className="flex items-center justify-center">
                                                <input className="submitbutton" type="submit" value="Submit"/>
                                            </div>
                                        </form>
                                    </>
                                ) :
                                    <>
                                        <button className="submitbutton" type="submit" value="Submit" onClick={() => navigate('login')}>
                                            Login
                                        </button>
                                    </>
                                }
                            </div>
                            <div className="login-top">
                                {Feedback === 'ERROR' && <h1 style={{color: 'red'}}>{("Something went wrong")}</h1>}
                            </div>
                            <div className="login-top">
                                {Feedback === 'PASSWORDERROR' &&
                                    <h1 style={{color: 'red'}}>{("Passwords do not mach")}</h1>}
                            </div>

                    </div>
                </article>
            </section>
        </div>
    )
}
