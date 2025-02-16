'use client';
import React, {useState, useEffect, useRef, ReactElement} from "react";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const initialCustomer = {
    id: "",
    name: "",
    phoneNumber: "",
};

const petTypes = [
    {value: "CAT", label: "CAT"},
    {value: "DOG", label: "DOG"},
    {value: "LIZARD", label: "LIZARD"},
    {value: "BIRD", label: "BIRD"},
    {value: "FISH", label: "FISH"},
    {value: "SNAKE", label: "SNAKE"},
    {value: "OTHER", label: "OTHER"}
];

const initialPet = {
    type: "",
    name: "",
    ownerId: "",
    birthDate: "2019-12-16T04:43:57.995Z",
    notes: ""
};

export default function Index(this: any) {

    const [customer, setCustomer] = useState(initialCustomer);
    const [pet, setPet] = useState(initialPet);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
    const [loading, setLoading] = useState(false)
    const [date, setDate] = useState(new Date());

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

    const handlePetChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setPet({
            ...pet,
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

    const addPet = (owner: string) => {
        setPetDialogOpen(!isPetDialogOpen)
        setSelectedOwner(owner.toString())
    };

    const handlePetSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            type: selectedPetType,
            name: pet.name,
            ownerId: selectedOwner,
            birthDate: date.toISOString(),
            notes: pet.notes
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

        setPetDialogOpen(false)


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
                            onClick={() => addPet(row.id)}
                    > Add
                    </button>
                </>
        }
    ];

    const [selectedOwner, setSelectedOwner] = useState('')
    const [selectedPetType, setSelectedPetType] = useState('CAT')
    const [isPetDialogOpen, setPetDialogOpen] = useState(false)

    const handleOptionSelect = (event: { target: { options: any; }; }) => {
        for (var i = 0, l = event.target.options.length; i < l; i++) {
            if (event.target.options[i].selected) {
                setSelectedPetType(event.target.options[i].value)
            }
        }
    };


    return (
        <div className="flex-container px-4 pb-4 pt-6 flex items-center justify-center">
            <div className="section">
                {!isPetDialogOpen ?
                    <>
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
                    </>
                    :
                    <>
                        <h1>Create a New Pet</h1>
                        <form onSubmit={handlePetSubmit}>
                            <input
                                type="text"
                                name="name"
                                id="name"
                                placeholder="Enter pet name"
                                onChange={handlePetChange}
                                value={pet.name}
                                maxLength={20}
                                required
                            />
                            <input
                                type="text"
                                name="notes"
                                id="notes"
                                placeholder="Enter notes"
                                onChange={handlePetChange}
                                value={pet.notes}
                                maxLength={40}
                                required
                            />
                            <select onChange={handleOptionSelect}>
                                {petTypes.map((pet, index) => (
                                    <option key={index} value={pet.value}>
                                        {pet.label}
                                    </option>
                                ))}
                            </select>
                            <br/>
                            Birthdate:
                            <DatePicker
                                dateFormat="yyyy-MM-dd"
                                selected={date}
                                onChange={date => setDate((date || new Date()))}
                            />
                            <div className="flex flex-row">
                                <input className="submitbutton" type="submit" value="Submit"/>
                                <button className="clearbutton" onClick={()=>setPetDialogOpen(false)}> Back </button>
                            </div>
                        </form>
                    </>
                }
            </div>
        </div>
    )
}

