import React, { FC, useRef, useEffect,useState } from "react";
import axios from "axios";

const initialValues = {
    id: "",
    name: "",
    price: "",
    description: "",
};

export default function Item(this: any) {


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
                'Authorization': sessionStorage.getItem("token")
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

    const [items, setItems] = useState([initialValues])
    const [loading, setLoading] = useState(false)


    const handleItemFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': sessionStorage.getItem("token")
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:8099/api/item', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setItems(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", axiosConfig);
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
                            Item name:
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
                            Price:
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
                            Description:
                            <input
                                type="text"
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
                <div>
                <div className="login-top">
                    <h1>{("All items")}</h1>
                </div>
                    <form onSubmit={handleItemFetch}>

                        <input id="fetchButton" type="submit" value="Get all items"/>
                    </form>
                    <div className="Item">
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <>
                                <table>
                                    <tr>
                                        <th>Name</th>
                                        <th>Price</th>
                                        <th>Description</th>
                                    </tr>
                                    {items.map(item => (
                                        <tr key={item.id}>
                                            <td>{item.name}</td>
                                            <td>{item.price}</td>
                                            <td>{item.description}</td>
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
