'use client'
import React, {useEffect, useState} from "react";
import axios from "axios";

const initialValues = {
    prompt: ""
};

const initialDalleValues = {
    prompt: ""
};
const initialDalleFeedback = {
    url: ""
};

export default function Index(this: any) {

    const openAIKey = (process.env.NEXT_PUBLIC_OPENAI_KEY || 'test')
    const openAiUrl = "https://api.openai.com/v1";

    const [values, setValues] = useState(initialValues);
    const [Feedback, setFeedback] = useState("")

    const [dalleValues, setDalleValues] = useState(initialDalleValues);
    const [DalleFeedback, setDalleFeedback] = useState(initialDalleFeedback)


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(values);
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };

    const handleDalleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(dalleValues);
        const {name, value} = event.target;
        setDalleValues({
            ...dalleValues,
            [name]: value,
        });
    };


    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant"
                },
                {
                    role: "user",
                    content: values.prompt
                }
            ]
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + openAIKey
            }
        };
        console.log("RESPONSE RECEIVED!!!!!!!!!!!!", postData);
        console.log("RESPONSE RECEIVED!!!!!!!!!!!!", axiosConfig);

        axios.post(openAiUrl + '/chat/completions', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data.choices[0].message.content);
                setFeedback(response.data.choices[0].message.content)

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                setFeedback("ERROR")
            })
    };

    const handleDalleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            model: "dall-e-3",
            prompt: dalleValues.prompt,
            n: 1,
            size: "1024x1024"
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + openAIKey
            }
        };

        console.log('openAIKey', dalleValues.prompt)


        axios.post(openAiUrl + '/images/generations', postData, axiosConfig)
            .then((response) => {
                console.log(response.data.data[0].url)
                setDalleFeedback({url: response.data.data[0].url})

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                // setDalleFeedback("ERROR")
            })
    };

    return (
        <div className="flex w-full flex-col">
            <div className="flex w-full flex-col items-center justify-center">
                    <div className="login-top">
                        <h1>{("Send a OpenAI Completition request")}</h1>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Prompt:
                            <input
                                type="text"
                                name="prompt"
                                placeholder="Enter prompt"
                                onChange={handleChange}
                                // value={values.prompt}
                                maxLength={50}
                                required
                                size={50}
                            />
                        </label>
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        <div className="login-error">
                            {Feedback && <h1 style={{color: 'green'}}>{(Feedback)}</h1>}
                        </div>
                    </form>
                    <div className="login-top">
                        <h1>{("Send an DALL-E request")}</h1>
                    </div>
                    <form onSubmit={handleDalleSubmit}>
                        <label>
                            Prompt:
                            <input
                                type="text"
                                name="prompt"
                                placeholder="Enter DALL-E prompt"
                                onChange={handleDalleChange}
                                // value={values.prompt}
                                maxLength={150}
                                required
                                size={50}
                            />
                        </label>
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        <br/>
                    </form>
                {DalleFeedback && <img src={DalleFeedback.url}></img>}
            </div>
        </div>


    )
}

