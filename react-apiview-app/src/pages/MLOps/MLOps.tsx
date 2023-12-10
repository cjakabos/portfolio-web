import React, {useEffect, useState} from "react";
import axios from "axios";
import { Document, Page, pdfjs } from 'react-pdf';

const initialValues = {
    prompt: ""
};

const initialCustomerValues = {
    id: "",
    corporation: "",
    lastmonth_activity: 0,
    lastyear_activity: 0,
    number_of_employees: 0,
    exited: 0
};

const initialSampleValues = {
    sampleSize: 10,
};

const initialGetCustomerValues = {
        id: "",
        corporation: 0,
        lastmonth_activity: 0,
        lastyear_activity: 0,
        number_of_employees: 0,
        exited: 0
};

const initialImageValues = {
    image2: "test2",
    image3: "test3",
    image4: "test4"
};

export const mlEndpoint = "http://127.0.0.1:8600";

export default function MLOps(this: any) {

    const [loading, setLoading] = useState(false)
    const [values, setValues] = useState(initialCustomerValues);
    const [values2, setValues2] = useState(initialSampleValues);
    const [customers, setCustomers] = useState([initialGetCustomerValues])
    const [images, setImages] = useState(initialImageValues)

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

    function getCustomers() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        axios.get(mlEndpoint + "/getCustomers", axiosConfig)
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
            }
        };

        const postData = {
            sampleSize: sample,
        };

        axios.post(mlEndpoint + "/getMLInfo", postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setImages(response.data)

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
                corporation: input.corporation,
                lastmonth_activity: Number(input.lastmonth_activity),
                lastyear_activity: Number(input.lastyear_activity),
                number_of_employees: Number(input.number_of_employees),
                exited: 0
            }
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        console.log("postData: ", postData);
        axios.post(mlEndpoint + "/ingest", postData, axiosConfig)
            .then((response) => {
                getCustomers()
                getMLInfo(0)
                //console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", error.response);
            })
    }


    return (
        <section>
            <article>
                <div className="login-top">
                    <h1>{("Create a customer")}</h1>
                </div>
                <form onSubmit={handleSubmit}>
                    <label>
                        Customer info:
                        <p/>
                        <input
                            type="text"
                            name="corporation"
                            placeholder="Enter corporation name"
                            onChange={handleChange}
                            value={values.corporation}
                            maxLength={50}
                            required
                            size={100}
                        />
                        <input
                            type="number"
                            name="lastmonth_activity"
                            placeholder="Enter customer lastmonth_activity"
                            onChange={handleChange}
                            value={values.lastmonth_activity}
                            maxLength={50}
                            required
                            size={100}
                        />
                        <input
                            type="number"
                            name="lastyear_activity"
                            placeholder="Enter customer lastyear_activity"
                            onChange={handleChange}
                            value={values.lastyear_activity}
                            maxLength={50}
                            required
                            size={100}
                        />
                        <input
                            type="number"
                            name="number_of_employees"
                            placeholder="Enter customer number_of_employees"
                            onChange={handleChange}
                            value={values.number_of_employees}
                            maxLength={50}
                            required
                            size={100}
                        />
                    </label>
                    <input className="login-submit" id="loginButton" type="submit" value="Submit"/>
                </form>
                <div>
                    <div className="login-top">
                        <h1>{("All customers")}
                            <form onSubmit={handleGetSubmit}>
                                <input className="login-submit" id="loginButton" type="submit" value="Get customers"/>
                            </form>
                        </h1>
                    </div>

                    <div className="Item">
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>Id</th>
                                        <th>Corporation</th>
                                        <th>Last Month Activity</th>
                                        <th>Last Year Activity</th>
                                        <th>Number of Employees</th>
                                        <th>Exited</th>
                                    </tr>
                                    {customers.map(customer => (
                                        <tr key={customer.id}>
                                            <td>{customer.id}</td>
                                            <td>{customer.corporation}</td>
                                            <td>{customer.lastmonth_activity}</td>
                                            <td>{customer.lastyear_activity}</td>
                                            <td>{customer.number_of_employees}</td>
                                            <td>{customer.exited}</td>
                                        </tr>
                                    ))}
                                </table>
                            </>
                        )}
                    </div>
                </div>
                <div className="container">
                    <h1>{("MLInfo")}
                        <form onSubmit={handleMLSubmit}>
                            <label>
                                Sample info:
                                <p/>
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
                            <input className="login-submit" id="loginButton" type="submit" value="Get MLInfo"/>
                        </form>
                    </h1>
                    <div className="container">
                        <button className="update-button"
                                style={{background: 'green', color: 'white'}}
                                onClick={() => getMLInfo(10)}
                        > Simulate 10 customers
                        </button>
                        <button className="update-button"
                                style={{background: 'green', color: 'white'}}
                                onClick={() => getMLInfo(20)}
                        > Simulate 20 customers
                        </button>
                        <button className="update-button"
                                style={{background: 'green', color: 'white'}}
                                onClick={() => getMLInfo(50)}
                        > Simulate 50 customers
                        </button>
                        <button className="update-button"
                                style={{background: 'green', color: 'white'}}
                                onClick={() => getMLInfo(100)}
                        > Simulate 100 customers
                        </button>
                        <button className="update-button"
                                style={{background: 'green', color: 'white'}}
                                onClick={() => getMLInfo(200)}
                        > Simulate 200 customers
                        </button>

                    </div>
                    <img src={'data:image/png;base64,' + images.image2} alt="Base64 Image" />
                    <img src={'data:image/png;base64,' + images.image3} alt="Base64 Image" />
                    <img src={'data:image/png;base64,' + images.image4} alt="Base64 Image" />
                </div>
            </article>
        </section>

    )
}

