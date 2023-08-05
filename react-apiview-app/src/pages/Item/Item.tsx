import React, { FC, useRef, useId, useEffect,useState } from "react";
import axios from "axios";

const initialValues = {
    name: "",
    price: "",
    description: "",
};

export default function Login(this: any) {

    const [values, setValues] = useState(initialValues);
    const [Name, setName] = useState("")

    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
        setValues({
            ...values,
            [name]: value,
        });
    };

    const handleItemSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        var postData = {
            name: values.name,
            price: values.price,
            description: values.description
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': localStorage.getItem("token")
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8099/api/item', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                //setName(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                //setName(error.response);
            })


    };

    return (
        <section>
            <article>
                <div>
                    <div className="login-top">
                        <h1>{("Create item")}</h1>
                    </div>
                    <form onSubmit={handleItemSubmit}>
                        <label>
                            Username:
                            <input
                                type="text"
                                name="name"
                                id="name"
                                placeholder="Enter item name"
                                onChange={handleChange}
                                value={values.name}
                                maxLength={20}
                                required
                            />
                        </label>
                        <label>
                            Password:
                            <input
                                type="number"
                                name="price"
                                id="price"
                                placeholder="Enter price"
                                onChange={handleChange}
                                value={values.price}
                                maxLength={20}
                                required
                            />
                        </label>
                        <label>
                            Password:
                            <input
                                type="number"
                                name="description"
                                id="description"
                                placeholder="Enter description"
                                onChange={handleChange}
                                value={values.description}
                                maxLength={20}
                                required
                            />
                        </label>
                        <input id="itemButton" type="submit" value="Submit"/>
                    </form>
                </div>
            </article>
        </section>
    )
}
