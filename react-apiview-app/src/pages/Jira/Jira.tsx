import React, {useState} from "react";
import axios from "axios";


const initialTicketValues = {
    summary: "",
    description: ""
};

export default function Jira(this: any) {

    const jiraKey = (process.env.REACT_APP_JIRA_KEY || 'test')
    const jiraProxy = "http://localhost:8500/webDomain";

    const [values, setValues] = useState(initialTicketValues);
    const [Feedback, setFeedback] = useState("")


    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            fields: {
                project:
                    {
                        key: "PW"
                    },
                summary: values.summary,
                description: values.description,
                issuetype: {
                    name: "Task"
                },
            },
            webDomain: "https://web-portfolio.atlassian.net/rest/api/latest/search?jql=project=PW&maxResults=1000",
            webApiKey: "Basic " + jiraKey
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        //console.log("postData: ", postData);
        axios.post(jiraProxy + "/get", postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response);

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                setFeedback("ERROR")
            })
    };

    return (
        <section>
            <article>
                <div>
                    <div className="login-top">
                        <h1>{("Get all Jira tickets")}</h1>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <input className="login-submit" id="loginButton" type="submit" value="Submit"/>
                        <div className="login-error">
                            {Feedback && <h1 style={{color: 'green'}}>{(Feedback)}</h1>}
                        </div>
                    </form>
                </div>
            </article>
        </section>


    )
}

