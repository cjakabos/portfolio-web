'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Input } from "@mui/material";


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
const jiraProxy = "http://localhost:80/jiraproxy/webDomain";

export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialTicketValues);
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
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/search?jql=project=" + process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY + "&maxResults=1000&fields=key,summary,description",
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${(process.env.NEXT_PUBLIC_JIRA_API_TOKEN || process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL)}`).toString("base64")
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
                console.log("RESPONSE RECEIVED: ", response);
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
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + reference.id,
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
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
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + ticketKey,
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
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
                        key: process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY
                    },
                summary: input.summary,
                description: input.description,
                issuetype: {
                    name: "Task"
                },
            },
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue",
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
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

    console.log('tickets', tickets)

    const columnsButton: GridColDef[] = [
        {field: "key", headerName: "Key", width: 80},
        {
            field: "summary",
            headerName: "Summary",
            width: 150,
            renderCell: (params) => {
                return <div className="rowitem">{params.row.fields.summary}</div>;
            },
        },
        {
            field: "description",
            headerName: "Description",
            width: 150, flex: 1,
            renderCell: (params) => {
                return <div className="rowitem">{params.row.fields.description}</div>;
            },
        },
        {
            field: "edit",
            headerName: "Edit",
            sortable: false,
            width: 110,
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
            width: 110,
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
                    <Dialog
                        open={isTicketOpen}
                        onClose={() => setTicketIsOpen(false)}
                        className="dialog"
                    >
                        <DialogTitle className="dialog">Update a Jira ticket</DialogTitle>
                        <DialogContent className="dialog">
                            <DialogContentText className="dialog">
                                Update a Jira ticket by providing title (summary) and description.
                            </DialogContentText>
                            <Input
                                defaultValue={selectedTicket.fields.summary}
                                autoFocus
                                margin="dense"
                                id="summary"
                                name="summary"
                                placeholder="Summary"
                                type="text"
                                fullWidth
                                onChange={handleChange}
                                required
                                className="dialog"
                            />
                            <Input
                                defaultValue={selectedTicket.fields.description}
                                autoFocus
                                margin="dense"
                                id="description"
                                name="description"
                                placeholder="Description"
                                type="text"
                                fullWidth
                                onChange={handleChange}
                                required
                                className="dialog"
                            />
                        </DialogContent>
                        <DialogActions className="dialog">
                            <Button onClick={() => setTicketIsOpen(false)}>Cancel</Button>
                            <Button type="submit" onClick={() => {
                                updateTicket(values, selectedTicket);
                                setTicketIsOpen(false)
                                }}>Submit</Button>
                        </DialogActions>
                    </Dialog>
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

