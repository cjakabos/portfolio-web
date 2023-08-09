import React, { useState } from "react";
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
        "PETTING",
        "FEEDING"
    ],
    daysAvailable: [],
};


const initialPet = {
    id: "",
    type: "CAT",
    name: "Kilo",
    ownerId: "1",
    birthDate: "2019-12-16T04:43:57.995Z",
    notes: "HI KILO"
};


export const options = [
    { value: "PETTING", label: "Petting" },
    { value: "WALKING", label: "Walking" },
    { value: "FEEDING", label: "Feeding" },
    { value: "MEDICATING", label: "Medicating" },
    { value: "SHAVING", label: "Shaving" }
];

export const days = [
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
    { value: "SATURDAY", label: "Saturday" },
    { value: "SUNDAY", label: "Sunday" }
];

export default function PetStore(this: any) {

    const [customer, setCustomer] = useState(initialCustomer);
    const [employee, setEmployee] = useState(initialEmployee);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
    const [allEmployees, setAllEmployees] = useState([initialEmployee]);
    const [availableEmployees, setAvailableEmployees] = useState([initialEmployee]);
    const [allPets, setAllPets] = useState([initialPet]);
    const [loading, setLoading] = useState(false)
    const [selectedOption, setSelectedOption] = useState(1);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState(initialEmployee.skills);
    const [selectedDayOption, setSelectedDayOption] = useState(["MONDAY", "TUESDAY", "FRIDAY"]);
    const [date, setDate] = useState(new Date());


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
        setCustomer({
            ...customer,
            [name]: value,
        });
    };

    const handleEmployeeChange = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
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
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/user/customer', postData, axiosConfig)
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
    function getCustomers () {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:8083/user/customer', axiosConfig)
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
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/user/employee', postData, axiosConfig)
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
    function getEmployees () {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:8083/user/employee', axiosConfig)
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
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/pet', postData, axiosConfig)
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
    function getPets () {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:8083/pet', axiosConfig)
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
    function getAvailability () {

        const postData = {
            date: date.toISOString().substring(0,10),
            skills: selectedMultiOptions
        };


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/user/employee/availability', postData, axiosConfig)
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
                valueTemp.push(options[i].value);
            }
        }
        setSelectedDayOption(valueTemp)

    };

    const scheduleSubmit = (employeeId: string, petId: any) => {
        const postData = {
            employeeIds: [employeeId],
            petIds: [petId],
            date: date.toISOString().substring(0,10),
            activities: selectedMultiOptions
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/schedule', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                getPets()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })


    };


    // @ts-ignore
    return (
        <section>
            <article>
                <div>
                    <div className="login-top">
                        <h1>{("Create a new customer")}</h1>
                    </div>
                    <form onSubmit={handleCustomerSubmit}>
                        <label>
                            Customer name:
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
                        </label>
                        <label>
                            Phone number:
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
                        </label>
                        <input className="customerButton" type="submit" value="Submit"/>
                    </form>
                </div>
                <div className="login-top">
                        <h1>{("All customers")}</h1>
                </div>
                        <form onSubmit={handleCustomerFetch}>

                            <input id="fetchButton" type="submit" value="Get all customers"/>
                        </form>
                        <div className="Item">
                            {loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    <table>
                                        <tr>
                                            <th>Name</th>
                                            <th>Phone</th>
                                        </tr>
                                        {allCustomers.map(customer => (
                                            <tr key={customer.id} >
                                                <td>{customer.name}</td>
                                                <td>{customer.phoneNumber}</td>
                                                <button className="pet-button" onClick={() => petSubmit(customer.id)}>Add a pet</button>
                                            </tr>
                                        ))}
                                    </table>
                                </>
                            )}
                        </div>


                <div className="login-top">
                    <h1>{("All pets")}</h1>
                </div>
                <form onSubmit={handlePetFetch}>

                    <input id="fetchButton" type="submit" value="Get all pets"/>
                </form>
                <div className="Item">
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            <table>
                                <tr>
                                    <th>Id</th>
                                    <th>Name</th>
                                    <th>OwnerId</th>
                                </tr>
                                {allPets.map(pet => (
                                    <tr key={pet.id} >
                                        <td>{pet.id}</td>
                                        <td>{pet.name}</td>
                                        <td>{pet.ownerId}</td>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>
                <div>
                <div className="login-top">
                        <h1>{("Create a new employee")}</h1>
                </div>
                    <form onSubmit={handleEmployeeSubmit}>
                        <label>
                            Employee name:
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
                        </label>
                        <label>
                            Skills
                            <select
                                onChange={handleMultiSelect}
                                id = "dropdown"
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
                        <label>
                            Days available
                            <select
                                onChange={handleDaysMultiSelect}
                                id = "dropdown2"
                                multiple
                                size={days.length}
                            >
                                {days.map((day, index) => (
                                    <option key={index} value={day.value}>
                                        {day.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <input className="employeeButton" type="submit" value="Submit"/>
                    </form>
                </div>
                <div className="login-top">
                    <h1>{("All employees")}</h1>
                </div>
                <form onSubmit={handleEmployeeFetch}>

                    <input id="fetchButton" type="submit" value="Get all employees"/>
                </form>
                <div className="Item">
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
                                {allEmployees.map(employee => (
                                    <tr key={employee.id} >
                                        <td>{employee.name}</td>
                                        <td>{employee.skills}</td>
                                        <td>{employee.daysAvailable}</td>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>
                <div className="login-top">
                    <h1>{("Availability")}</h1>
                </div>
                <div>
                    <form onSubmit={handleAvailabilityFetch}>
                        <label>
                            Skills
                            <select
                                onChange={handleMultiSelect}
                                id = "dropdown"
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
                        <input id="fetchButton" type="submit" value="Get availability"/>
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
                                        <tr key={employee.id} >
                                            <td>{employee.name}</td>
                                            <td>{employee.skills}</td>
                                            <td>{employee.daysAvailable}</td>
                                            <select onChange={handleOptionSelect} >
                                                <option value="string">Select...</option>
                                                {allPets.map((pet, index) => (
                                                    <option key={index} value={pet.id}>
                                                        Id: {pet.id}, Name: {pet.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <button className="pet-button" onClick={() => scheduleSubmit(
                                                employee.id,
                                                selectedOption
                                            ) }>Add a schedule</button>
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
