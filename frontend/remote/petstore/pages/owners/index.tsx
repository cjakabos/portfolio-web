'use client';
import React, {useState, useEffect, useRef, ReactElement} from "react";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const initialCustomer = {
    id: "",
    name: "",
    phoneNumber: "",
};

export default function Index(this: any) {

    const [customer, setCustomer] = useState(initialCustomer);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
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
        getCustomers()
    }, []);

    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setCustomer({
            ...customer,
            [name]: value,
        });
    };


    const handleCustomerSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            name: customer.name,
            phoneNumber: customer.phoneNumber,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/user/customer', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", customer.phoneNumber);
                getCustomers()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })


    };

    function getCustomers() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:80/petstore/user/customer', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setAllCustomers(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
            })
    };


    const petSubmit = (owner: string) => {

        const postData = {
            type: "CAT",
            name: "Kilo",
            ownerId: owner.toString(),
            birthDate: "2019-12-16T04:43:57.995Z",
            notes: "HI KILO"
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        console.log(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/pet', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", postData);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })


    };

    const columnsCustomers: GridColDef[] = [
        {field: "id", headerName: "ID", width: 30},
        {field: "name", headerName: "Name", width: 200},
        {field: "phoneNumber", headerName: "phoneNumber", width: 150},
        {
            field: "add",
            headerName: "Add pet",
            sortable: false,
            renderCell: ({row}) =>
                <>
                    <button className="submitbutton"
                            onClick={() => petSubmit(row.id)}
                    > Add
                    </button>
                </>
        }
    ];


    return (
        <div className="flex-container px-4 pb-4 pt-6 flex items-center justify-center">
            <div className="section">
                <h1>Create a New Customer</h1>
                <form onSubmit={handleCustomerSubmit}>
                    <input
                        type="text"
                        name="name"
                        id="name"
                        placeholder="Enter customer name"
                        onChange={handleChange}
                        value={customer.name}
                        maxLength={20}
                        required
                    />
                    <input
                        type="phone"
                        name="phoneNumber"
                        id="phoneNumber "
                        placeholder="Enter phone number"
                        onChange={handleChange}
                        value={customer.phoneNumber}
                        maxLength={20}
                        required
                    />
                    <input className="submitbutton" type="submit" value="Submit"/>
                </form>
                <h1>All Customers</h1>
                {loading ? <p>Loading...</p> : (
                    <>
                        <DataGrid
                            rows={allCustomers}
                            columns={columnsCustomers}
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

