'use client';
import React, {useEffect, useState} from "react";
import axios from "axios";
import {PopUp} from "../../components/PopUp/PopUp";
import {NoteTicket} from "../../data/dataNote";


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
    title: "",
    description: "",
};
export default function NoteFile(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialNoteValues);
    const [notes, setNotes] = useState(null)
    const [files, setFiles] = useState(null)
    const [currentFile, setCurrentFile] = useState(null)
    const [selectedNote, setSelectedNote] = useState(initialGetNoteValues)
    const [isOpen, setIsOpen] = useState(false)
    const [isNoteOpen, setNoteIsOpen] = useState(false)

    // Load all get methods once, when page renders
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
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        axios.get("http://localhost:8099" + "/note/user/" + localStorage.getItem("NEXT_PUBLIC_MY_USERNAME"), axiosConfig)
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
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        console.log("postData: ", postData);
        axios.post("http://localhost:8099" + "/note/updateNote", postData, axiosConfig)
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

    function deleteNote(noteKey: string) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        axios.get("http://localhost:8099" + "/note/delete/" + noteKey, axiosConfig)
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
            user: localStorage.getItem("NEXT_PUBLIC_MY_USERNAME"),
            title: input.title,
            description: input.description,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        console.log("postData: ", postData);
        console.log("axiosConfig: ", axiosConfig);
        axios.post("http://localhost:8099" + "/note/addNote", postData, axiosConfig)
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
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        axios.get("http://localhost:8099" + "/file/user/" + localStorage.getItem("NEXT_PUBLIC_MY_USERNAME"), axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setFiles(response.data)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    async function downloadFile(fileKey: string, fileName: string) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        console.log('filekey', fileKey)

        var options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': (localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || 'test')
            }
        }

        try {
            fetch("http://localhost:8099" + "/file/get-file/" + fileKey, options)
                .then((response) => {
                    console.log('response.headers.get(\'Content-Type\')', response.headers.get('Content-Type'))
                    response.blob().then((blob) => {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(function(){
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                        }, 100);
                    });
                })
                .catch((rejected) => {
                    console.log(rejected);
                });

        } catch (error) {
            console.log(error)
        }



        /*        axios.get("http://localhost:8099" + "/file/get-file/" + fileKey, axiosConfig)
                    .then((response) => {
                        //  console.log("RESPONSE RECEIVED: ", response);
                        try {
        /!*                    response.data.blob().then((blob: Blob | MediaSource) => {
                                let url = window.URL.createObjectURL(blob);
                                let a = document.createElement('a');
                                a.href = url;
                                a.download = 'CV_Jakabos.docx';
                                a.click();

                            })*!/
                        } catch (error) {
                            console.log(error)
                        }

                    })
                    .catch((error) => {
                        //console.log("AXIOS ERROR: ", postData);
                    })*/
    }
    function deleteFile(fileKey: string) {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
            }
        };

        axios.get("http://localhost:8099" + "/file/delete-file/" + fileKey, axiosConfig)
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

        if (currentFile !== null){

            let formData = new FormData();
            formData.append('fileUpload', (currentFile || 'test'));
            formData.append('username', (localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || 'test'));


            axios.post(
                'http://localhost:8099/file/upload',
                formData,
                {
                    headers: {
                        "Authorization": localStorage.getItem("NEXT_PUBLIC_MY_TOKEN"),
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

    if (loading) return <p>Loading...</p>

    return (
        <section>
            <article>
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
                            <input className="popup-submit" id="submitButton" type="submit" value="Submit"/>
                        </form>

                        <form onSubmit={() => setNoteIsOpen(false)}>
                            <input className="popup-close" id="closeButton" type="submit" value="CLOSE"/>
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
                            size={100}
                            height={500}
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
                            size={100}
                            height={50}
                        />
                    </label>
                    <br/>
                    <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                </form>
                <div>
                    <div className="login-top">
                        <h1>{("All notes")}
                            <form onSubmit={handleGetSubmit}>
                                <input className="submitbutton" id="loginButton" type="submit" value="Get notes"/>
                            </form>
                        </h1>
                    </div>

                    <div className="Item">
                        {notes != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>Key</th>
                                        <th>Title</th>
                                        <th>Description</th>
                                    </tr>
                                    {notes != null && notes.map(note => (
                                        <tr key={note.id}>
                                            <td>{note.id}</td>
                                            <td>{note.title}</td>
                                            <td>{note.description}</td>
                                            <button className="submitbutton"
                                                    onClick={() => initiateUpdateNote(note)}
                                            > Update
                                            </button>
                                            <button className="clearbutton"
                                                    onClick={() => deleteNote(note.id)}
                                            > Delete
                                            </button>
                                        </tr>
                                    ))}
                                </table>
                            </>
                        )}
                    </div>
                </div>
            </article>
            <article>
                <div className="login-top">
                    <h1>{("Upload a file")}</h1>
                </div>
                <div>
                    <div className="login-top">
                        <h1>{("All files")}
                        </h1>
                    </div>
                    <div>
                        {/* image preview */}
                        {/*<img src={this.state.image_preview} alt="image preview"/>*/}

                        {/* image input field */}
                        <input
                            type="file"
                            onChange={handleFilePreview}
                        />
                        <label>Upload file</label>
                        <input  className="submitbutton" type="submit" onClick={handleSubmitFile} value="Submit"/>
                    </div>
                    <div className="Files">
                        {notes != null && loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>File name</th>
                                        <th>File size</th>
                                    </tr>
                                    {files != null && files.map(file => (
                                        <tr key={file.id}>
                                            <td>{file.name}</td>
                                            <td>{file.fileSize}</td>
                                            <button className="submitbutton"
                                                    onClick={() => downloadFile(file.id, file.name)}
                                            > Download
                                            </button>
                                            <button className="clearbutton"
                                                    onClick={() => deleteFile(file.id)}
                                            > Delete
                                            </button>
                                        </tr>
                                    ))}
                                </table>
                            </>
                        )}
                    </div>
                </div>
            </article>
        </section>


    )
}

