import React, {useEffect, useState} from "react";
import axios from "axios";

const initialValues = {
    prompt: ""
};

const initialDalleValues = {
    prompt: ""
};
const initialDalleFeedback = {
    url1: "",
    url2: ""
};

export default function OpenAI(this: any) {

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
            model: 'text-davinci-003',
            prompt: values.prompt,
            max_tokens: 30,
            temperature: 0.7
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + openAIKey
            }
        };


        axios.post(openAiUrl + '/completions', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data.choices[0].text);
                setFeedback(response.data.choices[0].text)

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                setFeedback("ERROR")
            })
    };

    const handleDalleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            prompt: dalleValues.prompt,
            n: 2,
            size: "256x256"
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + openAIKey
            }
        };


        axios.post(openAiUrl + '/images/generations', postData, axiosConfig)
            .then((response) => {
                setDalleFeedback({url1: response.data.data[0].url, url2: response.data.data[1].url})

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
                                maxLength={50}
                                required
                                size={50}
                            />
                        </label>
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        <br/>
                        {DalleFeedback && <img src={DalleFeedback.url1}></img>}
                        <br/>
                        {DalleFeedback && <img src={DalleFeedback.url2}></img>}
                    </form>
            </div>
        </div>


    )
}

