'use client'
import React, {FC, useRef, useEffect, useState} from "react";
import axios from "axios";

const initialValues = {
    id: "",
    name: "",
    price: "",
    description: "",
};

const cartInitialValues = {
    id: "",
    items: [
        {
            id: "",
            name: "",
            price: "",
            description: "",
        }
    ],
    total: "",
    user: ""
};


export default function Index(this: any) {
    const [values, setValues] = useState(initialValues);
    const [Name, setName] = useState("")

    const [userToken, setUserToken] = useState('');
    const [username, setUsername] = useState('');

    //Make sure only runs once
    const effectRan = useRef(false);
    if (!effectRan.current) {
        if (typeof window !== "undefined") {
            setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
            setUsername(localStorage.getItem("NEXT_PUBLIC_MY_USERNAME") || '')
            console.log('this is the username: ', username)
            effectRan.current = true;
        }
    }

    useEffect(() => {
        getItems()
        getCart()
        getHistory()
    }, []);


    const handleChange = (event: { target: { name: any; value: any; }; }) => {
        const {name, value} = event.target;
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
                'Authorization': userToken
            }
        };
        console.log('console.log(axiosConfig)',axiosConfig)
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/cloudapp/item', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                //setName(response.data);
                getItems()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
                //setName(error.response);
            })


    };

    const [items, setItems] = useState([initialValues])
    const [cart, setCart] = useState(cartInitialValues.items)
    const [cartHistory, setCartHistory] = useState([cartInitialValues])
    const [total, setTotal] = useState([initialValues])
    const [loading, setLoading] = useState(false)


    const handleItemFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getItems()
    }

    function getItems() {
        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        setName(JSON.stringify(axiosConfig));
        axios.get('http://localhost:80/cloudapp/item', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setItems(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", error.response);
                //setName(error.response);
            })
    };

    const handleCartFetch = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getCart()
    }

    function getCart() {

        var postData = {
            username: username,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/cloudapp/cart/getCart', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                if (response.data != '') {
                    setCart(response.data.items);
                    setTotal(response.data.total);
                }

            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })
    };

    const handleCartClear = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        clearCart()
    }

    function clearCart() {

        var postData = {
            username: username,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/cloudapp/cart/clearCart', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                setCart(response.data.items);
                setTotal(response.data.total);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })
    };

    function addToCart(arg0: { id: string; name: string; price: string; description: string; }) {

        console.log("Row: " + arg0.name);

        var postData = {
            username: username,
            itemId: arg0.id,
            quantity: 1
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/cloudapp/cart/addToCart', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                getCart()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", postData);
            })

    };

    const handleCartSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:80/cloudapp/order/submit/' + username, '', axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.status);
                //setName(response.data);
                getHistory()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", 'http://localhost:80/cloudapp/order/submit/' + username);
                //setName(error.response);
            })

        clearCart()

    };

    const handleOrderHistorySubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        getHistory()
    }

    function getHistory() {

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };
        //setName(JSON.stringify(postData));
        axios.get('http://localhost:80/cloudapp/order/history/' + username, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", response.data);
                setCartHistory(response.data);
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ");
            })
    };

    return (
        <div className="flex w-full flex-col lg:h-[400px] lg:flex-row ">
            <div className="flex-container">
                <div className="section">
                    <h1>Create Item</h1>
                    <form onSubmit={handleItemSubmit}>
                        <table>
                            <tr>
                                <th><label htmlFor="name">Item Name:</label></th>
                                <td>
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
                                </td>
                            </tr>
                            <tr>
                                <th><label htmlFor="price">Price:</label></th>
                                <td>
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
                                </td>
                            </tr>
                            <tr>
                                <th><label htmlFor="description">Description:</label></th>
                                <td>
                                    <input
                                        type="text"
                                        name="description"
                                        id="description"
                                        placeholder="Enter description"
                                        onChange={handleChange}
                                        value={values.description}
                                        maxLength={100}
                                        required
                                    />
                                </td>
                            </tr>
                        </table>
                        <input className="submitbutton" type="submit" value="Submit"/>
                    </form>
                </div>
                <div className="section">
                    <h1>All Items</h1>
                    {loading ? <div className="loading">Loading...</div> : (
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
                                    <button className="submitbutton" onClick={() => addToCart(item)}>
                                        Add to cart
                                    </button>
                                </tr>
                            ))}
                        </table>
                    )}
                </div>
                <div className="section">
                    <h1>Cart Contents</h1>
                    {loading ? <div className="loading">Loading...</div> : (
                        <>
                            <table>
                                <tr>
                                    <th>Name</th>
                                    <th>Price</th>
                                    <th>Description</th>
                                </tr>
                                {cart.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.name}</td>
                                        <td>{item.price}</td>
                                        <td>{item.description}</td>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                    <button onClick={handleCartSubmit} className="submitbutton">Submit Cart</button>
                    <button onClick={handleCartClear} className="clearbutton">Clear Cart</button>
                </div>
                <div className="section">
                    <h1>Order History</h1>
                    <>
                        {cartHistory.map((cart, index) => (
                                <table>
                                    <tr>
                                        <th></th>
                                        <th></th>
                                        <th></th>
                                    </tr>
                                    <tr>
                                        <th> Order {index + 1} - Total price: {cart.total} </th>
                                        <th></th>
                                        <th></th>
                                    </tr>
                                    <tr>
                                        <th></th>
                                        <th></th>
                                        <th></th>
                                    </tr>
                                    <tr>
                                        <th>Name</th>
                                        <th>Price</th>
                                        <th>Description</th>
                                    </tr>
                                    {cart.items.map(item => (
                                        <tr key={item.id}>
                                            <td>{item.name}</td>
                                            <td>{item.price}</td>
                                            <td>{item.description}</td>
                                        </tr>
                                    ))
                                    }
                                </table>

                            )
                        )}
                    </>
                </div>
            </div>
        </div>

    )
}
