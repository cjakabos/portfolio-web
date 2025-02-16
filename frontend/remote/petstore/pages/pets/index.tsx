'use client';
import React, {useState, useEffect, useRef, ReactElement} from "react";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const initialPet = {
    id: "",
    type: "",
    name: "",
    ownerId: "",
    birthDate: "",
    notes: ""
};

export default function Index(this: any) {

    const [allPets, setAllPets] = useState([initialPet]);
    const [loading, setLoading] = useState(false)

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
        getPets()
    }, []);

    function getPets() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:80/petstore/pet', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setAllPets(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
            })
    };


    const columnsPets: GridColDef[] = [
        {field: "id", headerName: "ID", width: 30},
        {field: "name", headerName: "Name", width: 105},
        {field: "ownerId", headerName: "ownerId", width: 105},
        {field: "type", headerName: "type", width: 105},
        {field: "notes", headerName: "notes", width: 105},
    ];

    return (
        <div className="flex-container px-4 pb-4 pt-6 flex items-center justify-center">
            <div className="section ">
                <h1>All Pets</h1>
                {loading ? <p>Loading...</p> : (
                    <>
                        <DataGrid
                            rows={allPets}
                            columns={columnsPets}
                            className="text-black dark:text-white"
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
    )
}