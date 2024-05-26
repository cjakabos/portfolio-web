'use client';
import React, {useState, useEffect, useRef} from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


const initialCustomer = {
    id: "",
    name: "",
    phoneNumber: "",
};

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

    const [customer, setCustomer] = useState(initialCustomer);
    const [employee, setEmployee] = useState(initialEmployee);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
    const [allEmployees, setAllEmployees] = useState([initialEmployee]);
    const [availableEmployees, setAvailableEmployees] = useState([initialEmployee]);
    const [allPets, setAllPets] = useState([initialPet]);
    const [schedules, setSchedules] = useState([initialSchedule]);
    const [loading, setLoading] = useState(false)
    const [selectedOption, setSelectedOption] = useState(1);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState(initialEmployee.skills);
    const [selectedDayOption, setSelectedDayOption] = useState(["MONDAY", "TUESDAY", "FRIDAY"]);
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
        getPets()
        getEmployees()
        getSchedules()
    }, []);

    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setCustomer({
            ...customer,
            [name]: value,
        });
    };

    const handleEmployeeChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
        setEmployee({
            ...employee,
            [name]: value,
        });
    };

    const handleOptionSelect = (event: { target: { options: any; }; }) => {
        for (var i = 0, l = event.target.options.length; i < l; i++) {
            if (event.target.options[i].selected) {
                setSelectedOption(event.target.options[i].value)
            }
        }
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


    const handleCustomerFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getCustomers()
    }

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


    const handleEmployeeFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getEmployees()
    }

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
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/petstore/pet', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", postData);
                getPets()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })


    };

    const handlePetFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getPets()
    }

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


    return (
        <div className="flex w-full flex-col lg:flex-row ">
            <div className="flex-container">
                {/* Customer creation and listing */}
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
                            <table>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                </tr>
                                {allCustomers.map(customer => (
                                    <tr key={customer.id}>
                                        <td>{customer.name}</td>
                                        <td>{customer.phoneNumber}</td>
                                        {customer.id && <button className="submitbutton"
                                                                onClick={() => petSubmit(customer.id)}>Add a pet
                                        </button>}
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>
                <div className="section">
                    <h1>All Pets</h1>
                    {loading ? <p>Loading...</p> : (
                        <>
                            <table>
                                <tr>
                                    <th>Id</th>
                                    <th>Name</th>
                                    <th>OwnerId</th>
                                </tr>
                                {allPets.map(pet => (
                                    <tr key={pet.id}>
                                        <td>{pet.id}</td>
                                        <td>{pet.name}</td>
                                        <td>{pet.ownerId}</td>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>

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
                            <table>
                                <tr>
                                    <th>Name</th>
                                    <th>Skill</th>
                                    <th>Days available</th>
                                </tr>
                                {allEmployees.map(employee => (
                                    <tr key={employee.id}>
                                        <td>{employee.name}</td>
                                        <td>{employee.skills}</td>
                                        <td>{employee.daysAvailable}</td>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>
                <div className="section">
                    <h1>{("Availability")}</h1>
                    <form onSubmit={handleAvailabilityFetch}>
                        <label>
                            Skills
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
                        <DatePicker
                            dateFormat="yyyy-MM-dd"
                            selected={date}
                            onChange={date => setDate((date || new Date()))}
                        />
                        <br/>
                        <input className="submitbutton" id="fetchButton" type="submit" value="Get availability"/>
                    </form>
                    <div className="Availability2">
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>Name</th>
                                        <th>Skill</th>
                                        <th>Days available</th>
                                    </tr>
                                    {availableEmployees.map(employee => (
                                        <tr key={employee.id}>
                                            <td>{employee.name}</td>
                                            <td>{employee.skills}</td>
                                            <td>{employee.daysAvailable}</td>
                                            {employee.id && <select onChange={handleOptionSelect}>
                                                <option value="string">Select...</option>
                                                {allPets.map((pet, index) => (
                                                    <option key={index} value={pet.id}>
                                                        Id: {pet.id}, Name: {pet.name}
                                                    </option>
                                                ))}
                                            </select>}
                                            {employee.id &&
                                                <button className="submitbutton" onClick={() => scheduleSubmit(
                                                    employee.id,
                                                    selectedOption
                                                )}>Add a schedule</button>}
                                        </tr>
                                    ))}
                                </table>
                            </>
                        )}
                    </div>
                </div>
                <div className="section">
                    <h1>{("All planned schedules")}</h1>
                    <div className="Schedule">
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>EmployeeId</th>
                                        <th>PetId</th>
                                        <th>Date</th>
                                        <th>Activities</th>
                                    </tr>
                                    {schedules.map(schedule => (
                                        <tr key={schedule.id}>
                                            <td>{schedule.employeeIds}</td>
                                            <td>{schedule.petIds}</td>
                                            <td>{schedule.date}</td>
                                            <td>{schedule.activities}</td>
                                        </tr>
                                    ))}
                                </table>
                            </>
                        )}
                    </div>
                </div>
        </div>
</div>
)
}
