'use client';
import React, {ReactElement, useEffect, useRef, useState} from "react";
import axios from "axios";
import {PopUp} from "@/components/PopUp/PopUp";
import {NoteTicket} from "@/data/dataNote";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {ThemeProvider as NextThemesProvider} from "next-themes";
import Layout from "@/components/Layout";
import DashboardLayout from "@/components/DashboardLayout";


const initialValues = {
    prompt: ""
};


const initialFileValues = {
    id: 0,
    name: "",
    fileSize: "",
};
export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
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
        getFiles()
    }, []);


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
                <div className="Files">
                    {files != null && loading ? (
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