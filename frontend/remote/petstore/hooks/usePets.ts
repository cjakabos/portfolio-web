import { useState, useEffect, useRef } from "react";
import axios from "axios";

const initialPet = {
    id: "",
    type: "",
    name: "",
    ownerId: "",
    birthDate: "",
    notes: ""
};

export const usePets = () => {
    const [allPets, setAllPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [userToken, setUserToken] = useState('');

    const effectRan = useRef(false);

    // Initialize user token from localStorage
    useEffect(() => {
        if (!effectRan.current && typeof window !== "undefined") {
            setUserToken(`Bearer ${localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")}` || '');
            effectRan.current = true;
        }
    }, []);

    // Load pets when userToken is available
    useEffect(() => {
        getPets()
    }, [userToken]);

    const getPets = async () => {
        setLoading(true);
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': userToken
            }
        };

        try {
            const response = await axios.get(
                'http://localhost:80/petstore/pet',
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            setAllPets(response.data);
        } catch (error) {
            console.log("AXIOS ERROR: ", error);
        } finally {
            setLoading(false);
        }
    };

    return {
        allPets,
        loading,
        getPets,
    };
};