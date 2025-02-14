'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import {DataGrid, GridColDef} from "@mui/x-data-grid";

const initialValues = {
    prompt: ""
};

const initialCustomerValues = {
    id: "",
    gender: "",
    age: 18,
    annual_income: 15,
    spending_score: 5,
    segment: 0
};

const initialSampleValues = {
    sampleSize: 10,
};

const initialGetCustomerValues = {
    id: "",
    gender: "",
    age: 0,
    annual_income: 0,
    spending_score: 0,
    segment: 0
};

const initialImageValues = {
    image2: "test2",
    image3: "test3",
    image4: "test4"
};

const genders = [
    {value: "Female", label: "Female"},
    {value: "Male", label: "Male"}
];

const mlEndpoint = "http://localhost:80/mlops-segmentation";

export default function Index(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialCustomerValues);
    const [values2, setValues2] = useState(initialSampleValues);
    const [customers, setCustomers] = useState([initialGetCustomerValues])
    const [images, setImages] = useState(initialImageValues)
    const [selectedGender, setSelectedGender] = useState("Female");

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
        getMLInfo(-2)
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        console.log(values);
        const {name, value} = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };

    const handleChange2 = (event: { target: { name: any; value: any; }; }) => {
        console.log(values2);
        const {name, value} = event.target;
        setValues2({
            ...values2,
            [name]: value,
        });
    };


    const handleGetSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getCustomers()
    };

    const handleOptionSelect = (event: { target: { options: any; }; }) => {
        for (var i = 0, l = event.target.options.length; i < l; i++) {
            if (event.target.options[i].selected) {
                setSelectedGender(event.target.options[i].value)
            }
        }
    };

    function getCustomers() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        axios.get(mlEndpoint + "/getSegmentationCustomers", axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setCustomers(response.data)

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", Data);
            })
    }

    function getMLInfo(sample: number) {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        const postData = {
            sampleSize: Number(sample),
        };

        console.log("axiosConfig: ", axiosConfig);

        axios.post(mlEndpoint + "/getMLInfo", postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setImages(response.data)
                getCustomers()

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", Data);
            })
    }

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        newCustomer(values)
    };

    const handleMLSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getMLInfo(values2.sampleSize)
    };

    function newCustomer(input: any) {
        const postData = {
            fields: {
                gender: selectedGender,
                age: Number(input.age),
                annual_income: Number(input.annual_income),
                spending_score: Number(input.spending_score),
                segment: 0
            }
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);

        axios.post(mlEndpoint + "/addCustomer", postData, axiosConfig)
            .then((response) => {
                getCustomers()
                getMLInfo(-1)
                //console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", error.response);
            })

    }

    const columns: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "gender", headerName: "Gender", width: 80 },
        { field: "age", headerName: "Age", width: 50 },
        { field: "annual_income", headerName: "Annual Income", width: 120 },
        { field: "spending_score", headerName: "Spending score", width: 120 },
        { field: "segment", headerName: "Segment", width: 105 }
    ];


    return (
        <div className="flex-container px-4 pb-4 pt-6 flex-col items-center justify-center">
            <div className="">
                <div className="">
                <h1>{("Dataset creation with sampling from predefined DB or new data - choose one option")}</h1>
                <form onSubmit={handleSubmit}>
                    <div>
                        1. Manual data input
                    </div>

                    <label>
                        <select onChange={handleOptionSelect}>
                            {genders.map((gender, index) => (
                                <option key={index} value={gender.value}>
                                    {gender.label}
                                </option>
                            ))}
                        </select>
                        <div>
                        Customer age:
                        <input
                            type="number"
                            name="age"
                            placeholder="Enter customer age"
                            onChange={handleChange}
                            value={values.age}
                            maxLength={50}
                            required
                            min="18"
                            max="120"
                        />
                        </div>
                        <div>
                        Spending score:
                        <input
                            type="number"
                            name="spending_score"
                            placeholder="Enter customer spending_score"
                            onChange={handleChange}
                            value={values.spending_score}
                            maxLength={50}
                            required
                            min="5"
                            max="100"
                        />
                        <input className="submitbutton" id="loginButton" type="submit" value="Submit"/>
                        </div>
                    </label>
                    <br/>

                </form>
                </div>
                2. Test a sample size from predefined DB with specific amount of customer:
                <br/>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(10)}
                > 10
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(20)}
                > 20
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(50)}
                > 50
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(100)}
                > 100
                </button>
                <button className="ml-update-button"
                        onClick={() => getMLInfo(200)}
                > 200
                </button>
            </div>
            <div className="flex-row">
                <h1>{("ML Classification Results: ")}</h1>
                <div id="banner">
                    <div className="inline-block">
                        <img src={'data:image/png;base64,' + images.image3} alt="Base64 Image"
                             style={{height: 450, width: 550}}/>
                    </div>
                    <div className="inline-block">
                        <img src={'data:image/png;base64,' + images.image4} alt="Base64 Image"
                             style={{height: 450, width: 550}}/>
                    </div>
                </div>

            </div>
            <div className="section">
                <div className="Item">
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <>
                            Customer List
                            <DataGrid
                                rows={customers}
                                columns={columns}
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

