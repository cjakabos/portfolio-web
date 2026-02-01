import { useState, useCallback, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useItems = (token: string) => {
    const [items, setItems] = useState<any[]>([]);
    const [loadingItems, setLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/item`, {
                headers: { 'Authorization': token }
            });
            setItems(res.data);
        } catch (error) {
            console.error("Fetch Items Error", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const createItem = async (name: string, price: string, description: string) => {
        console.log("trying to create item2", name, price, description)
        try {
            await axios.post(`${API_URL}/item`,
                { name, price, description },
                { headers: { 'Authorization': token, 'Content-Type': 'application/json;charset=UTF-8' } }
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