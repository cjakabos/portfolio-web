import { useState, useEffect, useRef } from "react";
import axios from "axios";

const initialCustomer = {
    id: "",
    name: "",
    phoneNumber: "",
};

const initialPet = {
    type: "",
    name: "",
    ownerId: "",
    birthDate: "2019-12-16T04:43:57.995Z",
    notes: ""
};

export const useCustomers = () => {
    const [customer, setCustomer] = useState(initialCustomer);
    const [pet, setPet] = useState(initialPet);
    const [allCustomers, setAllCustomers] = useState([initialCustomer]);
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(new Date());
    const [userToken, setUserToken] = useState('');
    const [selectedOwner, setSelectedOwner] = useState('');
    const [selectedPetType, setSelectedPetType] = useState('CAT');
    const [isPetDialogOpen, setPetDialogOpen] = useState(false);

    const effectRan = useRef(false);

    // Initialize user token from localStorage
    useEffect(() => {
        if (!effectRan.current && typeof window !== "undefined") {
            setUserToken(`Bearer ${localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")}` || '');
            effectRan.current = true;
        }
    }, []);

    // Load customers when userToken is available
    useEffect(() => {
        getCustomers();
    }, [userToken]);

    const handleChange = (event: { target: { name: string; value: string } }) => {
        const { name, value } = event.target;
        setCustomer({
            ...customer,
            [name]: value,
        });
    };

    const handlePetChange = (event: { target: { name: string; value: string } }) => {
        const { name, value } = event.target;
        setPet({
            ...pet,
            [name]: value,
        });
    };

    const handleCustomerSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();

        const postData = {
            name: customer.name,
            phoneNumber: customer.phoneNumber,
        };

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        try {
            const response = await axios.post(
                'http://localhost:80/petstore/user/customer',
                postData,
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", customer.phoneNumber);
            await getCustomers();
            // Reset form
            setCustomer(initialCustomer);
        } catch (error) {
            console.log("AXIOS ERROR: ", postData);
        }
    };

    const getCustomers = async () => {
        setLoading(true);
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        try {
            const response = await axios.get(
                'http://localhost:80/petstore/user/customer',
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            setAllCustomers(response.data);
        } catch (error) {
            console.log("AXIOS ERROR: ", axiosConfig);
        } finally {
            setLoading(false);
        }
    };

    const addPet = (owner: string) => {
        setPetDialogOpen(!isPetDialogOpen);
        setSelectedOwner(owner.toString());
    };

    const handlePetSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();

        const postData = {
            type: selectedPetType,
            name: pet.name,
            ownerId: selectedOwner,
            birthDate: date.toISOString(),
            notes: pet.notes
        };

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        try {
            console.log(JSON.stringify(postData));
            const response = await axios.post(
                'http://localhost:80/petstore/pet',
                postData,
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", postData);
            // Reset pet form
            setPet(initialPet);
            setDate(new Date());
            setSelectedPetType('CAT');
        } catch (error) {
            console.log("AXIOS ERROR: ", postData);
        }

        setPetDialogOpen(false);
    };

    const handleOptionSelect = (event: { target: { options: HTMLOptionsCollection } }) => {
        for (let i = 0; i < event.target.options.length; i++) {
            if (event.target.options[i].selected) {
                setSelectedPetType(event.target.options[i].value);
            }
        }
    };

    return {
        customer,
        pet,
        allCustomers,
        loading,
        date,
        selectedOwner,
        selectedPetType,
        isPetDialogOpen,
        setDate,
        setPetDialogOpen,
        handleChange,
        handlePetChange,
        handleCustomerSubmit,
        handlePetSubmit,
        addPet,
        handleOptionSelect,
    };
};