import React, { useState } from "react";
import axios from "axios";
import { MultiSelect } from "react-multi-select-component";

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

export default function PetStore(this: any) {

    const [customer, setCustomer] = useState(initialCustomer);
    const [employee, setEmployee] = useState(initialEmployee);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
    const [allEmployees, setAllEmployees] = useState([initialEmployee]);
    const [allPets, setAllPets] = useState([initialPet]);
    const [loading, setLoading] = useState(false)
    const [selectedOption, setSelectedOption] = useState(initialEmployee.skills);


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

    const handleOptionSelect = (event: { target: { name: any; value: any; }; }) => {
        const { name, value } = event.target;
        setSelectedOption({
            ...selectedOption,
            [name]: value,
        });
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
            skills: selectedOption,
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            }
        };
        //setName(JSON.stringify(postData));
        axios.post('http://localhost:8083/user/employee', postData, axiosConfig)
            .then((response) => {
                console.log("RESPONSE RECEIVED: ", selectedOption);
                getEmployees()
            })
            .catch((error) => {
                console.log("AXIOS ERROR: ", selectedOption);
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








    //
    //
    // const handleItemSubmit = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //
    //     var postData = {
    //         name: values.name,
    //         price: values.price,
    //         description: values.description
    //     };
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.post('http://localhost:8099/api/item', postData, axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.status);
    //             //setName(response.data);
    //             getItems()
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", postData);
    //             //setName(error.response);
    //         })
    //
    //
    // };
    //
    // const [items, setItems] = useState([initialValues])
    // const [cart, setCart] = useState([initialValues])
    // const [cartHistory, setCartHistory] = useState([cartInitialValues])
    // const [total, setTotal] = useState([initialValues])
    // const [loading, setLoading] = useState(false)
    //
    //
    // const handleItemFetch = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //     getItems()
    //
    // }
    // function getItems () {
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.get('http://localhost:8099/api/item', axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.data);
    //             setItems(response.data);
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", axiosConfig);
    //             //setName(error.response);
    //         })
    // };
    //
    // const handleCartFetch = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //     getCart()
    // }
    // function getCart () {
    //
    //     var postData = {
    //         username: localStorage.getItem("REACT-APP-MY-USERNAME"),
    //     };
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.post('http://localhost:8099/api/cart/getCart', postData, axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.status);
    //             setCart(response.data.items);
    //             setTotal(response.data.total);
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", postData);
    //         })
    // };
    //
    // const handleCartClear = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //     clearCart()
    // }
    // function clearCart () {
    //
    //     var postData = {
    //         username: localStorage.getItem("REACT-APP-MY-USERNAME"),
    //     };
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.post('http://localhost:8099/api/cart/clearCart', postData, axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.status);
    //             setCart(response.data.items);
    //             setTotal(response.data.total);
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", postData);
    //         })
    // };
    //
    // function addToCart (arg0: { id: string; name: string; price: string; description: string; })  {
    //
    //     console.log("Row: " + arg0.name);
    //
    //     var postData = {
    //         username: localStorage.getItem("REACT-APP-MY-USERNAME"),
    //         itemId: arg0.id,
    //         quantity: 1
    //     };
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.post('http://localhost:8099/api/cart/addToCart', postData, axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.status);
    //             getCart()
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", postData);
    //         })
    //
    // };
    //
    // const handleCartSubmit = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.post('http://localhost:8099/api/order/submit/' + localStorage.getItem("REACT-APP-MY-USERNAME"), '', axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.status);
    //             //setName(response.data);
    //             getItems()
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ", 'http://localhost:8099/api/order/submit/' + localStorage.getItem("REACT-APP-MY-USERNAME"));
    //             //setName(error.response);
    //         })
    //
    //     clearCart()
    //
    // };
    //
    // const handleOrderHistorySubmit = (e: { preventDefault: () => void; }) => {
    //     e.preventDefault();
    //     getHistory()
    // }
    // function getHistory () {
    //
    //     let axiosConfig = {
    //         headers: {
    //             'Content-Type': 'application/json;charset=UTF-8',
    //             'Authorization': localStorage.getItem("REACT-APP-MY-TOKEN")
    //         }
    //     };
    //     //setName(JSON.stringify(postData));
    //     axios.get('http://localhost:8099/api/order/history/' + localStorage.getItem("REACT-APP-MY-USERNAME"), axiosConfig)
    //         .then((response) => {
    //             console.log("RESPONSE RECEIVED: ", response.data);
    //             setCartHistory(response.data);
    //         })
    //         .catch((error) => {
    //             console.log("AXIOS ERROR: ");
    //         })
    // };



    const handleMultiSelect = (event: { target: { options: any; }; }) => {

        var options = event.target.options;
        var valueTemp = [];
        for (var i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                valueTemp.push(options[i].value);
            }
        }
        setSelectedOption(valueTemp)

    };


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
                                    <th>Name</th>
                                    <th>OwnerId</th>
                                </tr>
                                {allPets.map(pet => (
                                    <tr key={pet.id} >
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
                            >
                                <option value="PETTING">Petting</option>
                                <option value="WALKING">Walking</option>
                                <option value="FEEDING">Feeding</option>
                                <option value="MEDICATING">Medicating</option>
                                <option value="SHAVING">Shaving</option>
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
                                        <button className="pet-button">Add a pet</button>
                                    </tr>
                                ))}
                            </table>
                        </>
                    )}
                </div>

            {/*    <div className="login-top">*/}
            {/*        <h1>{("All items")}</h1>*/}
            {/*    </div>*/}
            {/*        <form onSubmit={handleItemFetch}>*/}

            {/*            <input id="fetchButton" type="submit" value="Get all items"/>*/}
            {/*        </form>*/}
            {/*        <div className="Item">*/}
            {/*            {loading ? (*/}
            {/*                <div>Loading...</div>*/}
            {/*            ) : (*/}
            {/*                <>*/}
            {/*                    <table>*/}
            {/*                        <tr>*/}
            {/*                            <th>Name</th>*/}
            {/*                            <th>Price</th>*/}
            {/*                            <th>Description</th>*/}
            {/*                        </tr>*/}
            {/*                        {items.map(item => (*/}
            {/*                            <tr key={item.id} >*/}
            {/*                                <td>{item.name}</td>*/}
            {/*                                <td>{item.price}</td>*/}
            {/*                                <td>{item.description}</td>*/}
            {/*                                <button className="cart-button" onClick={() => addToCart(item)}>Add to cart</button>*/}
            {/*                            </tr>*/}
            {/*                        ))}*/}
            {/*                    </table>*/}
            {/*                </>*/}
            {/*            )}*/}
            {/*        </div>*/}
            {/*    <div className="login-top">*/}
            {/*            <h1>{("Cart contents")}</h1>*/}
            {/*    </div>*/}
            {/*        <form onSubmit={handleCartFetch}>*/}
            {/*            <input id="fetchButton" type="submit" value="Get cart contents"/>*/}
            {/*        </form>*/}
            {/*        <form onSubmit={handleCartClear}>*/}
            {/*            <input id="fetchButton" type="submit" value="Clear cart contents"/>*/}
            {/*        </form>*/}
            {/*        <div className="Cart">*/}
            {/*            {loading ? (*/}
            {/*                <div>Loading...</div>*/}
            {/*            ) : (*/}
            {/*                <>*/}
            {/*                    <table>*/}
            {/*                        <tr>*/}
            {/*                            <th>Name</th>*/}
            {/*                            <th>Price</th>*/}
            {/*                            <th>Description</th>*/}
            {/*                        </tr>*/}
            {/*                        {cart.map(item => (*/}
            {/*                            <tr key={item.id} >*/}
            {/*                                <td>{item.name}</td>*/}
            {/*                                <td>{item.price}</td>*/}
            {/*                                <td>{item.description}</td>*/}
            {/*                            </tr>*/}
            {/*                        ))}*/}
            {/*                    </table>*/}
            {/*                </>*/}
            {/*            )}*/}
            {/*        </div>*/}

            {/*    <div className="login-top">*/}
            {/*            <h1>{("Submit cart")}</h1>*/}
            {/*    </div>*/}
            {/*        <form onSubmit={handleCartSubmit}>*/}

            {/*            <input id="fetchButton" type="submit" value="Submit cart"/>*/}
            {/*        </form>*/}
            {/*    <div className="login-top">*/}
            {/*            <h1>{("Order history")}</h1>*/}
            {/*    </div>*/}
            {/*        <form onSubmit={handleOrderHistorySubmit}>*/}

            {/*            <input id="fetchButton" type="submit" value="Get order history"/>*/}
            {/*        </form>*/}

            {/*        <div className="Item">*/}
            {/*            {loading ? (*/}
            {/*                <div>Loading...</div>*/}
            {/*            ) : (*/}
            {/*                <>*/}
            {/*                    {cartHistory.map((cart,index) => (*/}

            {/*                        // cart.forEach((index) => {*/}
            {/*                            //console.log("item: ", JSON.stringify(cart.items))*/}
            {/*                        // })*/}

            {/*                                <table>*/}
            {/*                                    <tr>*/}
            {/*                                        <th> </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                    </tr>*/}
            {/*                                    <tr>*/}
            {/*                                        <th> Order {index+1} - Total price: {cart.total} </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                    </tr>*/}
            {/*                                    <tr>*/}
            {/*                                        <th> </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                        <th> </th>*/}
            {/*                                    </tr>*/}
            {/*                                    <tr>*/}
            {/*                                        <th>Name</th>*/}
            {/*                                        <th>Price</th>*/}
            {/*                                        <th>Description</th>*/}
            {/*                                    </tr>*/}
            {/*                                    {cart.items.map(item => (*/}
            {/*                                        <tr key={item.id} >*/}
            {/*                                            <td>{item.name}</td>*/}
            {/*                                            <td>{item.price}</td>*/}
            {/*                                            <td>{item.description}</td>*/}
            {/*                                        </tr>*/}
            {/*                                    ))*/}
            {/*                                    }*/}
            {/*                                </table>*/}

            {/*                            )*/}
            {/*                    )}*/}
            {/*                </>*/}
            {/*            )}*/}
            {/*        </div>*/}
            {/*</div>*/}

            </article>
        </section>

    )
}
