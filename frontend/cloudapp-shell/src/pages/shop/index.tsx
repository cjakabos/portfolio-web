'use client'
import React, {FC, useRef, useEffect, useState} from "react";
import axios from "axios";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import DialogActions from "@mui/material/DialogActions";
import { Input } from "@mui/material";

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

        setModal1Open(false);
        setValues(initialValues)

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

        setModal3Open(false);
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
        setModal3Open(false);
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

    const columns: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "name", headerName: "Name", width: 105 },
        { field: "price", headerName: "Price", width: 105 },
        { field: "description", headerName: "Description", width: 105 }
    ];

    const columnsButton: GridColDef[] = [
        { field: "id", headerName: "ID", width: 50 },
        { field: "name", headerName: "Name", width: 105 },
        { field: "price", headerName: "Price", width: 50 },
        { field: "description", headerName: "Description", width: 250 },
        {
            field: "action",
            headerName: "Add to Cart",
            sortable: false,
            renderCell: ({row}) =>
                <button className="submitbutton" onClick={() => addToCart(row)}>
                    Add
                </button>
        },
    ];

    const [isModal1Open, setModal1Open] = useState(false)
    const [isModal2Open, setModal2Open] = useState(false)
    const [isModal3Open, setModal3Open] = useState(false)

    return (
        <div className="flex-container px-4 pb-4 pt-6 flex-col items-center justify-center">
            <div className="">
                <Button variant="outlined" onClick={() => setModal1Open(true)}>
                    Items
                </Button>
                <Button variant="outlined" onClick={() => setModal2Open(true)}>
                    Order history
                </Button>
                {cart.length > 0 ?
                        <Button variant="contained" onClick={() => setModal3Open(true)}>
                            Check Cart
                        </Button>
                    :
                        <Button variant="outlined" onClick={() => setModal3Open(true)}>
                            Check Cart
                        </Button>
                }
                <Dialog
                    open={isModal1Open}
                    onClose={() => setModal1Open(false)}
                    className="dialog"
                >
                    <DialogTitle className="dialog">Item Creator</DialogTitle>
                    <DialogContent className="dialog">
                        <DialogContentText className="dialog">
                            Create an Item by providing name, price and description
                        </DialogContentText>
                        <Input
                            value={values.name}
                            autoFocus
                            margin="dense"
                            id="name"
                            name="name"
                            placeholder="Name"
                            type="text"
                            fullWidth
                            onChange={handleChange}
                            required
                            className="dialog"
                            color="primary"
                        />
                        <Input
                            value={values.price}
                            autoFocus
                            margin="dense"
                            id="price"
                            name="price"
                            placeholder="Price"
                            type="number"
                            fullWidth
                            onChange={handleChange}
                            required
                            className="dialog"
                        />
                        <Input
                            value={values.description}
                            autoFocus
                            margin="dense"
                            id="description"
                            name="description"
                            placeholder="Description"
                            type="text"
                            fullWidth
                            onChange={handleChange}
                            required
                            className="dialog"
                        />
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal1Open(false)}>Cancel</Button>
                        <Button type="submit" onClick={handleItemSubmit}>Submit</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal2Open}
                    onClose={() => setModal2Open(false)}
                    className="dialog"
                >
                    <DialogTitle className="dialog">Order history</DialogTitle>
                    <DialogContent className="dialog">
                        <DialogContentText className="dialog">
                            List of previous orders.
                        </DialogContentText>
                        <h1>Order History</h1>
                        <>
                            {cartHistory.map((cart, index) => (
                                    <table>
                                        <tbody>
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
                                        </tbody>
                                    </table>

                                )
                            )}
                        </>
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal2Open(false)}>Cancel</Button>
                    </DialogActions>
                </Dialog>
                <Dialog
                    open={isModal3Open}
                    onClose={() => setModal3Open(false)}
                    className="dialog"
                >
                    <DialogTitle className="dialog">Cart contents</DialogTitle>
                    <DialogContent className="dialog">
                        <DialogContentText className="dialog">
                            List of items in Cart.
                        </DialogContentText>
                        <div className="Files">
                            {cart != null && loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    {cart.length > 0 ?
                                        <>
                                            <div className="login-top">
                                                <h1>{("Cart")}
                                                </h1>
                                                <div className="flex">
                                                    <button onClick={handleCartSubmit} className="submitbutton">Submit Cart</button>
                                                    <button onClick={handleCartClear} className="clearbutton">Clear Cart</button>
                                                </div>
                                            </div>
                                            <DataGrid
                                                rows={cart}
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
                                        : <>Your cart is empty</>}
                                </>
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions className="dialog">
                        <Button onClick={() => setModal3Open(false)}>Cancel</Button>
                    </DialogActions>
                </Dialog>
            </div>
            <div className="flex-row">
                <div className="section">
                    <div>
                        <div className="Item">
                            {items != null && loading ? (
                                <div>Loading...</div>
                            ) : (
                                <>
                                    {items.length > 0 ?
                                        <>
                                            <div className="login-top">
                                                <h1>{("All items")}
                                                </h1>
                                            </div>
                                            <DataGrid
                                                rows={items}
                                                columns={columnsButton}
                                                className="text-black dark:text-white h-auto w-full"
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
                                        : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
