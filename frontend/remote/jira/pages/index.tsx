'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import {PopUp} from "../components/PopUp/PopUp";
import {JiraTicket} from "../data/dataJira";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { HTMLToJSON } from 'html-to-json-parser';


const initialValues = {
    prompt: ""
};

const initialTicketValues = {
    id: "",
    key: "",
    summary: "",
    description: "",
};

const initialGetTicketValues = {
    id: "",
    key: "",
    fields: {
        summary: "",
        description: ""
    }
};
const jiraProxy = "http://localhost:8501/jiraproxy/webDomain";

export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialTicketValues);
    const [table, setTable] = useState('')
    const [tickets, setTickets] = useState([initialGetTicketValues])
    const [selectedTicket, setSelectedTicket] = useState(initialGetTicketValues)
    const [isOpen, setIsOpen] = useState(false)
    const [isTicketOpen, setTicketIsOpen] = useState(false)

    const [userToken, setUserToken] = useState('');
    //Make sure only runs once
    const effectRan = useRef(false);
    if (!effectRan.current) {
        if (typeof window !== "undefined") {
            setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
            effectRan.current = true;
        }
    }

    // Load all get methods once, when page renders
    useEffect(() => {
        getTickets()
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(values);
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
        getTickets()
    };


    const handleGetSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getTickets()
    };

    function getTickets() {
        const postData = {
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'test') + "/rest/api/latest/search?jql=project=PW&maxResults=1000&fields=key,summary,description",
            webApiKey: "Basic " + (process.env.NEXT_PUBLIC_JIRA_KEY || 'test')
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post(jiraProxy + "/get", postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data.issues);
                setTickets(response.data.issues)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    function updateTicket(ticket: any, reference: any) {
        console.log("reference: ", reference);
        console.log("ticket: ", ticket);
        let postData = {
            update: {
                summary: [
                    {
                        set: (ticket.summary || reference.fields.summary)
                    }
                ],
                description: [
                    {
                        set: (ticket.description || reference.fields.description)
                    }
                ]
            },
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'test') + "/rest/api/latest/issue/" + reference.id,
            webApiKey: "Basic " + (process.env.NEXT_PUBLIC_JIRA_KEY || 'test')
        };


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        //console.log("postData: ", postData);
        axios.put(jiraProxy + "/put", postData, axiosConfig)
            .then((response) => {
                getTickets()

            })
            .catch((error) => {
                console.log(error.status)
            })
    }

    function initiateUpdateTicket(ticket: any) {
        setSelectedTicket(ticket)
        setTicketIsOpen(!isTicketOpen)
        console.log("ticket: ", ticket);
    }

    function deleteTicket(ticketKey: string) {
        const postData = {
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'test') + "/rest/api/latest/issue/" + ticketKey,
            webApiKey: "Basic " + (process.env.NEXT_PUBLIC_JIRA_KEY || 'test')
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post(jiraProxy + "/delete", postData, axiosConfig)
            .then((response) => {
                //console.log("RESPONSE RECEIVED: ", response.data.issues);
                getTickets()

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        newTicket(values)
    };

    function newTicket(input: any) {
        const postData = {
            fields: {
                project:
                    {
                        key: "PW"
                    },
                summary: input.summary,
                description: input.description,
                issuetype: {
                    name: "Task"
                },
            },
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN || 'test') + "/rest/api/latest/issue",
            webApiKey: "Basic " + (process.env.NEXT_PUBLIC_JIRA_KEY || 'test')
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post(jiraProxy + "/post", postData, axiosConfig)
            .then((response) => {
                getTickets()
                //console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", error.response);
            })
    }
    const [updates, setUpdates] = useState(initialTicketValues);
    const change = (event: { target: { name: any; value: any; }; }) => {
        console.log(updates);
        const {name, value} = event.target;
        setUpdates({
            ...updates,
            [name]: value,
        });
    };

    console.log('tickets', tickets)

    const columnsButton: GridColDef[] = [
        {field: "key", headerName: "Key", minWidth: 50},
        {
            field: "summary",
            headerName: "Summary",
            minWidth: 150,
            renderCell: (params) => {
                return <div className="rowitem">{params.row.fields.summary}</div>;
            },
        },
        {
            field: "description",
            headerName: "Description",
            minWidth: 100,
            renderCell: (params) => {
                return <div className="rowitem">{params.row.fields.description}</div>;
            },
        },
        {
            field: "edit",
            headerName: "Edit",
            sortable: false,
            minWidth: 110,
            renderCell: ({row}) =>
                <>
                    <button className="submitbutton"
                            onClick={() => initiateUpdateTicket(row)}
                    > Update
                    </button>
                </>
        },
        {
            field: "delete",
            headerName: "Delete",
            sortable: false,
            minWidth: 110,
            renderCell: ({row}) =>
                <>
                    <button className="clearbutton"
                            onClick={() => deleteTicket(row.id)}
                    > Delete
                    </button>
                </>
        },
    ];

    if (loading) return <p>Loading...</p>

    return (
        <>
            <div className="flex w-full flex-col items-center justify-center">
                {isTicketOpen ?
                    <PopUp
                    >
                        <form onSubmit={() => updateTicket(updates, selectedTicket)}>
                            <label>
                                <input
                                    type="text"
                                    name="summary"
                                    defaultValue={selectedTicket.fields.summary}
                                    //value={updates.summary}
                                    onChange={change}
                                    maxLength={50}
                                    required
                                    size={50}
                                />
                                <input
                                    type="text"
                                    name="description"
                                    defaultValue={selectedTicket.fields.description}
                                    //value={updates.description}
                                    onChange={change}
                                    maxLength={50}
                                    required
                                    size={50}
                                />
                            </label>
                            <br/>
                            <input className="submitbutton" id="submitButton" type="submit" value="Submit"/>
                        </form>

                        <form onSubmit={() => setTicketIsOpen(false)}>
                            <input className="clearbutton" id="clearButton" type="submit" value="CLOSE"/>
                        </form>
                    </PopUp>
                    : null}
                <div className="login-top">
                    <h1>{("Create a Jira ticket")}</h1>
                </div>
                <form onSubmit={handleSubmit}>
                    <label>
                        <input
                            type="text"
                            name="summary"
                            placeholder="Enter ticket title"
                            onChange={handleChange}
                            value={values.summary}
                            maxLength={50}
                            required
                            size={50}
                            height={50}
                        />
                        <br/>
                        <input
                            type="text"
                            name="description"
                            placeholder="Enter ticket description"
                            onChange={handleChange}
                            value={values.description}
                            maxLength={50}
                            required
                            size={50}
                            height={50}
                        />
                    </label>
                    <br/>
                    <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                </form>
                <div>

                    <div className="Item">
                        {tickets != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <DataGrid
                                    rows={tickets}
                                    columns={columnsButton}
                                    className="text-black dark:text-white h-auto"
                                    slotProps={{
                                        row: {
                                            className: "text-black dark:text-white"
                                        },
                                        cell: {
                                            className: "text-black dark:text-white",
                                        },
                                        pagination: {
                                            className: "text-black dark:text-white",
                                        },
                                    }}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>


    )
}

