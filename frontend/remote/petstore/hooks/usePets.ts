import { useState, useEffect } from "react";
import axios from "axios";
import type { Pet } from "../types";

export const usePets = () => {
    const [allPets, setAllPets] = useState<Pet[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        void getPets();
    }, []);

    const getPets = async () => {
        setLoading(true);
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
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
