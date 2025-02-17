'use client';
import React, {useState, useEffect, useRef, ReactElement} from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Owners from "./owners";
import Pets from "./pets";
import Employees from "./employees";

const initialEmployee = {
    id: "",
    name: "",
    skills: [
        ""
    ],
    daysAvailable: [],
};


const initialPet = {
    id: "",
    type: "",
    name: "",
    ownerId: "",
    birthDate: "",
    notes: ""
};

const initialSchedule = {
    id: 0,
    employeeIds: [],
    petIds: [],
    date: "",
    activities: [
        ""
    ]
};


const options = [
    {value: "PETTING", label: "Petting"},
    {value: "WALKING", label: "Walking"},
    {value: "FEEDING", label: "Feeding"},
    {value: "MEDICATING", label: "Medicating"},
    {value: "SHAVING", label: "Shaving"}
];

export default function Index(this: any) {

    const [availableEmployees, setAvailableEmployees] = useState([]);
    const [allPets, setAllPets] = useState([initialPet]);
    const [schedules, setSchedules] = useState([initialSchedule]);
    const [loading, setLoading] = useState(false)
    const [selectedOption, setSelectedOption] = useState(1);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState(initialEmployee.skills);
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
        getPets()
        getSchedules()
    }, []);

    const handleOptionSelect = (event: { target: { options: any; }; }) => {
        for (var i = 0, l = event.target.options.length; i < l; i++) {
            if (event.target.options[i].selected) {
                setSelectedOption(event.target.options[i].value)
            }
        }
    };

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

    const handleAvailabilityFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getAvailability()
    }

    function getAvailability() {

        const postData = {
            date: date.toISOString().substring(0, 10),
            skills: selectedMultiOptions
        };


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/user/employee/availability', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", postData);
                setAvailableEmployees(response.data);
                getPets()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
            })
    };

    const handleMultiSelect = (event: { target: { options: any; }; }) => {

        var options = event.target.options;
        var valueTemp = [];
        for (var i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                // @ts-ignore
                valueTemp.push(options[i].value);
            }
        }
        setSelectedMultiOptions(valueTemp)

    };

    const scheduleSubmit = (employeeId: string, petId: any) => {
        const postData = {
            employeeIds: [employeeId],
            petIds: [petId],
            date: date.toISOString().substring(0, 10),
            activities: selectedMultiOptions
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/schedule', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                getSchedules()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })
    };

    function getSchedules() {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:80/petstore/schedule', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setSchedules(response.data);
                getPets()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
                //setName(error.response);
            })
    };

    const columnsSchedules: GridColDef[] = [
        {field: "id", headerName: "ID", width: 30},
        {field: "employeeIds", headerName: "employeeIds", width: 105},
        {field: "petIds", headerName: "petIds"},
        {field: "date", headerName: "date"},
        {field: "activities", headerName: "activities"},
    ];

    const columnsAvailability: GridColDef[] = [
        {field: "id", headerName: "ID", width: 30},
        {field: "name", headerName: "Name", width: 105},
        {
            field: "pet",
            headerName: "Pet",
            sortable: false,
            renderCell: ({row}) =>
                <>
                    <select onChange={handleOptionSelect}>
                        <option value="string">Select...</option>
                        {allPets.map((pet, index) => (
                            <option key={index} value={pet.id}>
                                Id: {pet.id}, Name: {pet.name}
                            </option>
                        ))}
                    </select>
                </>
        },
        {
            field: "add",
            headerName: "Add",
            sortable: false,
            renderCell: ({row}) =>
                <>
                    <button className="submitbutton" onClick={() => scheduleSubmit(
                        row.id,
                        selectedOption
                    )}>Add
                    </button>
                </>
        }
    ];

    const [isModal1Open, setModal1Open] = useState(false)
    const [isModal2Open, setModal2Open] = useState(false)
    const [isModal3Open, setModal3Open] = useState(false)


    return (
        <div className="flex-container px-4 pb-4 pt-6 flex-col items-center justify-center">
            <div className="">
                <Button variant="outlined" onClick={() => setModal1Open(true)}>
                    Owners
                </Button>
                <Button variant="outlined" onClick={() => setModal2Open(true)}>
                    Pets
                </Button>
                <Button variant="outlined" onClick={() => setModal3Open(true)}>
                    Employees
                </Button>
                <Dialog
                    open={isModal1Open}
                    onClose={() => setModal1Open(false)}
                    maxWidth="xl"
                    className="dialog"
                >
                    <DialogTitle className="dialog">Owners</DialogTitle>
                    <DialogContent className="dialog">
                        <Owners/>
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal1Open(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal2Open}
                    onClose={() => setModal2Open(false)}
                    maxWidth="xl"
                    className="dialog"
                >
                    <DialogTitle className="dialog">Pets</DialogTitle>
                    <DialogContent className="dialog">
                        <Pets/>
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal2Open(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal3Open}
                    onClose={() => setModal3Open(false)}
                    maxWidth="xl"
                    className="dialog"
                >
                    <DialogTitle className="dialog">Employees</DialogTitle>
                    <DialogContent className="dialog">
                        <Employees/>
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal3Open(false)}>Close</Button>
                    </DialogActions>
                </Dialog>
            </div>
            <div className="">
                <div className="flex-row">
                    <h1>{("Availability")}</h1>
                    Pick day:
                    <DatePicker
                        dateFormat="yyyy-MM-dd"
                        selected={date}
                        onChange={date => setDate((date || new Date()))}
                    />
                    <form onSubmit={handleAvailabilityFetch}>
                        <br/>
                        <label>
                            Pick skills:
                            <br/>
                            <select
                                onChange={handleMultiSelect}
                                id="dropdown"
                                multiple
                                size={options.length}
                            >
                                {options.map((option, index) => (
                                    <option key={index} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <input className="submitbutton" id="fetchButton" type="submit" value="Get availability"/>
                    </form>
                </div>
                <div className="flex-row">
                    <div className="section">
                        <h1>{("Available employees")}</h1>
                        <div className="Schedule">
                            {loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    <DataGrid
                                        rows={availableEmployees}
                                        columns={columnsAvailability}
                                        className="text-black dark:text-white h-auto w-auto"
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

                <div className="flex-row">
                    <div className="section">
                        <h1>{("All planned schedules")}</h1>
                        <div className="Schedule">
                            {loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    <DataGrid
                                        rows={schedules}
                                        columns={columnsSchedules}
                                        className="text-black dark:text-white h-auto w-auto"
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
        </div>
    )
}
