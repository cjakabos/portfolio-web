'use client';
import React, {ReactElement, useEffect, useRef, useState} from "react";
import axios from "axios";
import {PopUp} from "@/components/PopUp/PopUp";
import {NoteTicket} from "@/data/dataNote";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {ThemeProvider as NextThemesProvider} from "next-themes";
import Layout from "@/components/Layout";
import DashboardLayout from "@/components/DashboardLayout";


const initialNoteValues = {
    user: "",
    title: "",
    description: "",
};

const initialGetNoteValues = {
    user: "",
    title: "",
    description: "",
};

const initialUpdateNoteValues = {
    id: 0,
    user: "",
    title: "",
    description: "",
};

export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialNoteValues);
    const [notes, setNotes] = useState([initialUpdateNoteValues])
    const [selectedNote, setSelectedNote] = useState(initialGetNoteValues)
    const [isOpen, setIsOpen] = useState(false)
    const [isNoteOpen, setNoteIsOpen] = useState(false)

    const [userToken, setUserToken] = useState('');
    const [username, setUsername] = useState('');

    //Make sure only runs once
    const effectRan = useRef(false);
    if (!effectRan.current) {
        if (typeof window !== "undefined") {
            setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
            setUsername(localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || '')
            console.log('this is the username: ', username)
            effectRan.current = true;
        }
    }
    useEffect(() => {
        getNotes()
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(values);
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };


    function getNotes() {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        axios.get("http://localhost:80/cloudapp" + "/note/user/" + username, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setNotes(response.data)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    function updateNote(note: any, reference: any) {
        console.log("reference: ", reference);
        console.log("note: ", note);
        let postData = {
            id: (note.id || reference.id),
            title: (note.title || reference.title),
            description: (note.description || reference.description),
        };


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post("http://localhost:80/cloudapp" + "/note/updateNote", postData, axiosConfig)
            .then((response) => {
                console.log("AXIOS response: ", response);
                getNotes()

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
            })
        setNoteIsOpen(!isNoteOpen)
        getNotes()
    }

    function initiateUpdateNote(note: NoteTicket) {
        console.log("note: ", note);
        setSelectedNote(note)
        setNoteIsOpen(!isNoteOpen)
        setUpdates(note)
    }

    function deleteNote(noteKey: number) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        axios.get("http://localhost:80/cloudapp" + "/note/delete/" + noteKey, axiosConfig)
            .then((response) => {
                //console.log("RESPONSE RECEIVED: ", response.data.issues);
                getNotes()

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        newNote(values)
    };

    function newNote(input: any) {
        const postData = {
            user: username,
            title: input.title,
            description: input.description,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        console.log("axiosConfig: ", axiosConfig);
        axios.post("http://localhost:80/cloudapp" + "/note/addNote", postData, axiosConfig)
            .then((response) => {
                getNotes()
                //console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", error.response);
            })
    }

    const [updates, setUpdates] = useState(initialNoteValues);
    const change = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setUpdates({
            ...updates,
            [name]: value,
        });
        console.log(updates);
    };


    const columnsNotes: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "title", headerName: "Title", width: 105 },
        { field: "description", headerName: "Description", width: 200 },
        {
            field: "edit",
            headerName: "Edit",
            sortable: false,
            width: 100,
            renderCell: ({row}) =>
                <button className="submitbutton" onClick={() => initiateUpdateNote(row)}>
                    Edit
                </button>
        },
        {
            field: "delete",
            headerName: "Delete",
            sortable: false,
            width: 100,
            renderCell: ({row}) =>
                <button className="clearbutton" onClick={() => deleteNote(row)}>
                    Delete
                </button>
        },
    ];


    if (loading) return <p>Loading...</p>

    return (
        <div className="flex-container">
            <div className="section">
                {isNoteOpen ?
                    <PopUp
                    >
                        <form onSubmit={() => updateNote(updates, selectedNote)}>
                            <label>
                                Note info:
                                <p/>
                                <input
                                    type="text"
                                    name="title"
                                    defaultValue={selectedNote.title}
                                    //value={updates.title}
                                    onChange={change}
                                    maxLength={50}
                                    required
                                    size={50}
                                />
                                <input
                                    type="text"
                                    name="description"
                                    defaultValue={selectedNote.description}
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

                        <form onSubmit={() => setNoteIsOpen(false)}>
                            <input className="clearbutton" id="closeButton" type="submit" value="CLOSE"/>
                        </form>
                    </PopUp>
                    : null}
                <div className="login-top">
                    <h1>{("Create a note")}</h1>
                </div>
                <form onSubmit={handleSubmit}>
                    <label>
                        Note info:
                        <p/>
                        <input
                            type="text"
                            name="title"
                            placeholder="Enter note title"
                            onChange={handleChange}
                            value={values.title}
                            maxLength={50}
                            required
                            size={50}
                            height={50}
                        />
                        <br/>
                        <input
                            type="text"
                            name="description"
                            placeholder="Enter note description"
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
            </div>
            <div className="section">
                <div>
                    <div className="login-top">
                        <h1>{("All notes")}
                        </h1>
                    </div>

                    <div className="Item">
                        {notes != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <DataGrid
                                    rows={notes}
                                    columns={columnsNotes}
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
        </div>
    )
}

Index.getLayout = function getLayout(page: ReactElement) {
    let menuVariant = [
        {url: '/notefile', caption: 'Notes'},
        {url: '/notefile/files', caption: 'Files'}
    ]

    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
            <Layout>
                <DashboardLayout menuVariant={menuVariant}>{page}</DashboardLayout>
            </Layout>
        </NextThemesProvider>
    )
}