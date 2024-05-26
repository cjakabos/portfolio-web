'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import Select from "react-select";

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


    return (
        <section>
            <article>
                <div className="flex w-full flex-col lg:h-[400px] lg:flex-row ">
                    <div className="flex-container">
                        <div className="section">
                            <h1>{("Dataset creation with sampling from predefined DB or new data - choose one option")}</h1>
                            <form onSubmit={handleMLSubmit}>
                                <label>
                                    1. Test a sample size from predefined DB:<br/>
                                    <input
                                        type="number"
                                        name="sampleSize"
                                        placeholder="Enter sampleSize"
                                        onChange={handleChange2}
                                        value={values2.sampleSize}
                                        maxLength={50}
                                        required
                                        size={100}
                                        min="10"
                                        max="200"
                                    />
                                </label>
                                <input className="submitbutton" id="loginButton" type="submit" value="Get MLInfo"/>
                            </form>
                            <br/><br/>2. Test a sample size from predefined DB:<br/>
                            <button className="ml-update-button"
                                    onClick={() => getMLInfo(10)}
                            > Simulate 10 customers
                            </button>
                            <button className="ml-update-button"
                                    onClick={() => getMLInfo(20)}
                            > Simulate 20 customers
                            </button>
                            <button className="ml-update-button"
                                    onClick={() => getMLInfo(50)}
                            > Simulate 50 customers
                            </button>
                            <button className="ml-update-button"
                                    onClick={() => getMLInfo(100)}
                            > Simulate 100 customers
                            </button>
                            <button className="ml-update-button"
                                    onClick={() => getMLInfo(200)}
                            > Simulate 200 customers
                            </button>

                            <br/>
                            <br/>
                            <form onSubmit={handleSubmit}>
                                <label>
                                    3. Add new Customer info on the top of predefined data:
                                    <p/>
                                    <table>
                                        <tr>
                                            <th>Gender</th>
                                            <th>Age</th>
                                            <th>Spending score</th>
                                            <th>Annual Income</th>
                                            <th></th>
                                        </tr>
                                        <td>
                                            <select onChange={handleOptionSelect}>
                                                {genders.map((gender, index) => (
                                                    <option key={index} value={gender.value}>
                                                        {gender.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                name="age"
                                                placeholder="Enter customer age"
                                                onChange={handleChange}
                                                value={values.age}
                                                maxLength={50}
                                                required
                                                size={100}
                                                min="18"
                                                max="120"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                name="annual_income"
                                                placeholder="Enter customer annual_income"
                                                onChange={handleChange}
                                                value={values.annual_income}
                                                maxLength={50}
                                                required
                                                size={100}
                                                min="15"
                                                max="140"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                name="spending_score"
                                                placeholder="Enter customer spending_score"
                                                onChange={handleChange}
                                                value={values.spending_score}
                                                maxLength={50}
                                                required
                                                size={100}
                                                min="5"
                                                max="100"
                                            />
                                        </td>
                                        <td>
                                            <input className="submitbutton" id="loginButton" type="submit"
                                                   value="Submit"/>
                                        </td>
                                    </table>

                                </label>

                            </form>
                            <br/>
                            <br/>
                        </div>
                        <div className="section">
                            <h1>{("MLInfo Results: ")}</h1>
                            <div id="banner">
                                <div className="inline-block">
                                    <img src={'data:image/png;base64,' + images.image3} alt="Base64 Image"
                                         style={{height: 500, width: 500}}/>
                                </div>
                                <div className="inline-block">
                                    <img src={'data:image/png;base64,' + images.image4} alt="Base64 Image"
                                         style={{height: 500, width: 500}}/>
                                </div>
                            </div>

                        </div>
                        <div className="section">
                            <br/>
                            <br/>
                            <br/>

                            <div className="Item">
                                {loading ? (
                                    <div>Loading...</div>
                                ) : (
                                    <>
                                        <table>
                                            <tr>
                                                <th>Id</th>
                                                <th>Gender</th>
                                                <th>Age</th>
                                                <th>Annual Income</th>
                                                <th>Spending Score</th>
                                                <th>Segment</th>
                                            </tr>
                                            {customers.map(customer => (
                                                <tr key={customer.id}>
                                                    <td>{customer.id}</td>
                                                    <td>{customer.gender}</td>
                                                    <td>{customer.age}</td>
                                                    <td>{customer.annual_income}</td>
                                                    <td>{customer.spending_score}</td>
                                                    <td>{customer.segment}</td>
                                                </tr>
                                            ))}
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </section>

)
}

