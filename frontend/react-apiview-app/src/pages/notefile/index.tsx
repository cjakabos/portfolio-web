'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import {PopUp} from "../../components/PopUp/PopUp";
import {NoteTicket} from "../../data/dataNote";
import { DataGrid, GridColDef } from "@mui/x-data-grid";


const initialValues = {
    prompt: ""
};

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

const initialFileValues = {
    id: 0,
    name: "",
    fileSize: "",
};
export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialNoteValues);
    const [notes, setNotes] = useState([initialUpdateNoteValues])
    const [files, setFiles] = useState([initialFileValues])
    const [currentFile, setCurrentFile] = useState(null)
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
        getFiles()
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(values);
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };


    const handleGetSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getNotes()
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

    console.log('notes', notes)

    function getFiles() {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        axios.get("http://localhost:80/cloudapp" + "/file/user/" + username, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setFiles(response.data)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    async function downloadFile(fileKey: number, fileName: string) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        console.log('filekey', fileKey)

        var options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': (userToken || 'test')
            }
        }

        try {
            fetch("http://localhost:80/cloudapp" + "/file/get-file/" + fileKey, options)
                .then((response) => {
                    console.log('response.headers.get(\'Content-Type\')', response.headers.get('Content-Type'))
                    response.blob().then((blob) => {
                        if (typeof window !== "undefined") {
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(function () {
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                            }, 100);
                        }
                    });
                })
                .catch((rejected) => {
                    console.log(rejected);
                });

        } catch (error) {
            console.log(error)
        }
    }

    function deleteFile(fileKey: number) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        axios.get("http://localhost:80/cloudapp" + "/file/delete-file/" + fileKey, axiosConfig)
            .then((response) => {
                //console.log("RESPONSE RECEIVED: ", response.data.issues);
                getFiles()

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    // Image Preview Handler
    const handleFilePreview = (e) => {
        let image_as_base64 = URL.createObjectURL(e.target.files[0])
        let image_as_files = e.target.files[0];

        setCurrentFile(image_as_files)
    }

    // Image/File Submit Handler
    const handleSubmitFile = () => {

        if (currentFile !== null) {

            let formData = new FormData();
            formData.append('fileUpload', (currentFile || 'test'));
            formData.append('username', (username || 'test'));


            axios.post(
                'http://localhost:80/cloudapp' + '/file/upload',
                formData,
                {
                    headers: {
                        "Authorization": userToken,
                        "Content-type": "multipart/form-data",
                    },
                }
            )
                .then(res => {
                    console.log(`Success` + res.data);
                    getFiles();
                })
                .catch(err => {
                    console.log(err);
                })
        }
    }

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

    const columnsFiles: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "name", headerName: "Name", width: 200 },
        { field: "fileSize", headerName: "Size", width: 80 },
        {
            field: "download",
            headerName: "Download",
            sortable: false,
            width: 120,
            renderCell: ({row}) =>
                <button className="submitbutton" onClick={() => downloadFile(row.id, row.name)}>
                    Download
                </button>
        },
        {
            field: "delete",
            headerName: "Delete",
            sortable: false,
            width: 100,
            renderCell: ({row}) =>
                <button className="clearbutton" onClick={() => deleteFile(row)}>
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
                <h1>{("Upload a file")}</h1>

                <div>
                    {/* image preview */}
                    {/*<img src={this.state.image_preview} alt="image preview"/>*/}

                    {/* image input field */}
                    <input
                        type="file"
                        onChange={handleFilePreview}
                    />
                    <label>Upload file</label>
                    <input className="submitbutton" type="submit" onClick={handleSubmitFile} value="Submit"/>
                </div>
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
            <div className="section">
                <div className="Files">
                    {notes != null && loading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            <DataGrid
                                rows={files}
                                columns={columnsFiles}
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
    )
}

