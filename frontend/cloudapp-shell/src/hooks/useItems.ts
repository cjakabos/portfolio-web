import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { getCloudAppCsrfHeaders } from "./cloudappCsrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useItems = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loadingItems, setLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/item`, {
                withCredentials: true,
            });
            setItems(res.data);
        } catch (error) {
            console.error("Fetch Items Error", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const createItem = async (name: string, price: string, description: string) => {
        try {
            const csrfHeaders = await getCloudAppCsrfHeaders(API_URL);
            await axios.post(`${API_URL}/item`,
                { name, price, description },
                {
                    headers: { ...csrfHeaders, 'Content-Type': 'application/json;charset=UTF-8' },
                    withCredentials: true,
                }
            );
            await fetchItems(); // Refresh list
            return true;
        } catch (error) {
            console.error("Create Item Error", error);
            return false;
        }
    };

    return { items, loadingItems, fetchItems, createItem };
};
