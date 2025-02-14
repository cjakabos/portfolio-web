'use client';
import React, {useState, useEffect, useRef, ReactElement} from "react";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const initialEmployee = {
    id: "",
    name: "",
    skills: [
        ""
    ],
    daysAvailable: [],
};

const options = [
    {value: "PETTING", label: "Petting"},
    {value: "WALKING", label: "Walking"},
    {value: "FEEDING", label: "Feeding"},
    {value: "MEDICATING", label: "Medicating"},
    {value: "SHAVING", label: "Shaving"}
];

const days = [
    {value: "MONDAY", label: "Monday"},
    {value: "TUESDAY", label: "Tuesday"},
    {value: "WEDNESDAY", label: "Wednesday"},
    {value: "THURSDAY", label: "Thursday"},
    {value: "FRIDAY", label: "Friday"},
    {value: "SATURDAY", label: "Saturday"},
    {value: "SUNDAY", label: "Sunday"}
];

export default function Index(this: any) {

    const [employee, setEmployee] = useState(initialEmployee);
    const [allEmployees, setAllEmployees] = useState([initialEmployee]);
    const [loading, setLoading] = useState(false)
    const [selectedMultiOptions, setSelectedMultiOptions] = useState(initialEmployee.skills);
    const [selectedDayOption, setSelectedDayOption] = useState(["MONDAY", "TUESDAY", "FRIDAY"]);

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
        getEmployees()
    }, []);


    const handleEmployeeChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setEmployee({
            ...employee,
            [name]: value,
        });
    };

    const handleEmployeeSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        const postData = {
            name: employee.name,
            skills: selectedMultiOptions,
            daysAvailable: selectedDayOption,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/user/employee', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                getEmployees()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
            })


    };

    function getEmployees() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:80/petstore/user/employee', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setAllEmployees(response.data);
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

    const handleDaysMultiSelect = (event: { target: { options: any; }; }) => {

        var options = event.target.options;
        var valueTemp = [];
        for (var i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                // @ts-ignore
                valueTemp.push(options[i].value);
            }
        }
        setSelectedDayOption(valueTemp)

    };

    const columnsEmployees: GridColDef[] = [
        {field: "id", headerName: "ID", width: 30},
        {field: "name", headerName: "Name", width: 105},
        {field: "skills", headerName: "Skills", width: 150},
        {field: "daysAvailable", headerName: "Days Available", width: 150},
    ];

    return (
        <div className="flex-container px-4 pb-4 pt-6 flex items-center justify-center">
            {/* Employee creation and listing */}
            <div className="section">
                <h1>Create a New Employee</h1>
                <form onSubmit={handleEmployeeSubmit}>
                    <input
                        type="text"
                        name="name"
                        id="name"
                        placeholder="Enter employee name"
                        onChange={handleEmployeeChange}
                        value={employee.name}
                        maxLength={20}
                        required
                    />
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
                    <select
                        onChange={handleDaysMultiSelect}
                        id="dropdown2"
                        multiple
                        size={days.length}
                    >
                        {days.map((day, index) => (
                            <option key={index} value={day.value}>
                                {day.label}
                            </option>
                        ))}
                    </select>
                    <input className="submitbutton" type="submit" value="Submit"/>
                </form>
            </div>
            <div className="section">
                <h1>All Employees</h1>
                {loading ? <p>Loading...</p> : (
                    <>
                        <DataGrid
                            rows={allEmployees}
                            columns={columnsEmployees}
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
