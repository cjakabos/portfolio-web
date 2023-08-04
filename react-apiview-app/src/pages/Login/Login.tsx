import React, { FC, useRef, useId, useEffect,useState } from "react";
import axios from "axios";

const initialValues = {
    username: "aaaa",
    firstname: "bbbb",
    lastname: "cccc",
    password: "dddd",
    feedback: "defaultFeedback",
};

export default function Login(this: any) {



    return (
            <section>
                <article>
                    <div>
                        <div className="login-top">
                            <h1>{("Sign in")}</h1>
                        </div>
                        <form>
                            <label>
                                Username:
                                <input
                                    type="username"
                                    name="username"
                                    id="inputUsername"
                                    placeholder="Enter Username"
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
