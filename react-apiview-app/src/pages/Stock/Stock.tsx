import React, { useEffect, useState } from "react";
// @ts-ignore
import logo from "./logo.svg";
import axios from "axios";

const initialValues = {
    username: "",
    firstname: "",
    lastname: "",
    password: "",
    feedback: "defaultFeedback",
};
export default function Stock() {

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

        var postData = {
            firstname: values.firstname,
            lastname: values.lastname,
            username: values.username,
            password: values.password
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        };

        axios.post('http://localhost:8081/signup/api', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
            })


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

  return (
      <div>
          <img src={logo} className="App-logo" alt="logo" />
          <section>
              <article>
                  <div>
                      <div className="login-top">
                          <h1>{("Sign up")}</h1>
                      </div>
                      <form onSubmit={handleSubmit}>
                          <label>
                              First name:
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
                          </label>
                          <br/>
                          <label>
                              Last name:
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
                          </label>
                          <br/>
                          <label>
                              Username:
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
                          </label>
                          <br/>
                          <label>
                              Password:
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
                          </label>
                          <br/>
                          {/*<h2>Username: {values.username} and Passoword: {values.password} and feedback is: {Name}</h2>*/}
                          {/*   onClick={() => functionName()}                        */}
                          {/* <input id="loginButton" type="submit" value="Submit" onClick={e => setName("test")}/>*/}
                          <input type="submit" value="Submit" />
                      </form>
                  </div>
              </article>
          </section>
      </div>
  )
}
