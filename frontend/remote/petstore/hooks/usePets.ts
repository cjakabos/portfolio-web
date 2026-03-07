import { useState, useEffect } from "react";
import axios from "axios";
import type { Pet } from "../types";
import { getGatewayBaseUrl } from "./gatewayBaseUrl";

const PETSTORE_PET_URL = `${getGatewayBaseUrl()}/petstore/pet`;

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
                PETSTORE_PET_URL,
                axiosConfig
            );
            setAllPets(response.data);
        } catch (error) {
            console.error("Failed to fetch pets", error);
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
