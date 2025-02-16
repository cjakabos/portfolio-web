'use client';
import React, {ReactElement, useEffect, useRef, useState} from "react";
import axios from "axios";
import {NoteTicket} from "@/data/dataNote";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Input } from "@mui/material";

const initialFileValues = {
    id: 0,
    name: "",
    fileSize: "",
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

export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialNoteValues);
    const [notes, setNotes] = useState([initialUpdateNoteValues])
    const [selectedNote, setSelectedNote] = useState(initialGetNoteValues)
    const [files, setFiles] = useState([initialFileValues])
    const [currentFile, setCurrentFile] = useState(null)
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
        setModal3Open(!isModal3Open)
        setValues(note)
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
        setModal1Open(false)
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
                <button className="clearbutton" onClick={() => deleteNote(row.id)}>
                    Delete
                </button>
        },
    ];

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
                    setModal2Open(false);
                })
                .catch(err => {
                    console.log(err);
                })
        }
    }

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
                <button className="clearbutton" onClick={() => deleteFile(row.id)}>
                    Delete
                </button>
        },
    ];

    const [isModal1Open, setModal1Open] = useState(false)
    const [isModal2Open, setModal2Open] = useState(false)
    const [isModal3Open, setModal3Open] = useState(false)

    if (loading) return <p>Loading...</p>

    return (
        <div className="flex-container px-4 pb-4 pt-6 flex-col items-center justify-center">
            <div className="">
                <Button variant="outlined" onClick={() => setModal1Open(true)}>
                    Notes
                </Button>
                <Button variant="outlined" onClick={() => setModal2Open(true)}>
                    Files
                </Button>
                <Dialog
                    open={isModal1Open}
                    onClose={() => setModal1Open(false)}
                    className="dialog"
                >
                    <DialogTitle className="dialog">Note Creator</DialogTitle>
                    <DialogContent className="dialog">
                        <DialogContentText className="dialog">
                            Create a Note by providing title (summary) and description.
                        </DialogContentText>
                        <Input
                            value={values.title}
                            autoFocus
                            margin="dense"
                            id="title"
                            name="title"
                            placeholder="Title"
                            type="text"
                            fullWidth
                            onChange={handleChange}
                            required
                            className="dialog"
                        />
                        <Input
                            value={values.description}
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
                        <Button onClick={() => setModal1Open(false)}>Cancel</Button>
                        <Button type="submit" onClick={handleSubmit}>Submit</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal3Open}
                    onClose={() => setModal3Open(false)}
                    className="dialog"
                >
                    <DialogTitle className="dialog">Update a Note</DialogTitle>
                    <DialogContent className="dialog">
                        <DialogContentText className="dialog">
                            Update a Note with title and description
                        </DialogContentText>
                        <Input
                            defaultValue={selectedNote.title}
                            autoFocus
                            margin="dense"
                            id="title"
                            name="title"
                            placeholder="Title"
                            type="text"
                            fullWidth
                            onChange={handleChange}
                            required
                            className="dialog"
                        />
                        <Input
                            defaultValue={selectedNote.description}
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
                        <Button onClick={() => setModal3Open(false)}>Cancel</Button>
                        <Button type="submit" onClick={() => {
                            updateNote(values, selectedNote);
                            setModal3Open(false)
                        }}>Submit</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal2Open}
                    onClose={() => setModal2Open(false)}
                    maxWidth="xl"
                    className="dialog"
                >
                    <DialogTitle className="dialog">Files upload</DialogTitle>
                    <DialogContent className="dialog">
                        <input
                            type="file"
                            onChange={handleFilePreview}
                        />
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal2Open(false)}>Cancel</Button>
                        <Button type="submit" onClick={handleSubmitFile}>Submit</Button>
                    </DialogActions>
                </Dialog>
            </div>
            <div className="flex-row">
            <div className="section">
                <div className="login-top">
                    <h1>{("All notes")}
                    </h1>
                </div>
                <div>
                    <div className="Item">
                        {notes != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                {notes.length > 0 ?
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
                                    : null}
                            </>
                        )}
                    </div>
                </div>
            </div>
                <div className="section">
                    <div className="login-top">
                        <h1>{("All files")}
                        </h1>
                    </div>
                    <div className="Files">
                        {files != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                {files.length > 0 ?
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
                                    : null}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
