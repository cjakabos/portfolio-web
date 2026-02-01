import { useState, useCallback } from "react";
import axios from "axios";
import { Item, Cart } from '../../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useCart = (username: string, token: string) => {
    const [cart, setCart] = useState<Cart>({id: 1, items: [], total: 0 });
    const [total, setTotal] = useState<any>(null); // Depending on API, might be string or obj
    const [history, setHistory] = useState<any[]>([]);
    const [loadingCart, setLoading] = useState(false);

    const getHeaders = () => ({
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': token
    });

    const fetchCart = useCallback(async () => {
        if (!username || !token) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/cart/getCart`,
                { username },
                { headers: getHeaders() }
            );
            if (res.data) {
                setCart({ id: res.data.id, items: res.data.items || [], total: res.data.total });
                setTotal(res.data.total);
            }
        } catch (error) {
            console.error("Fetch Cart Error", error);
        } finally {
            setLoading(false);
        }
    }, [username, token]);

    const addToCart = async (item: any) => {
        try {
            await axios.post(`${API_URL}/cart/addToCart`,
                { username, itemId: item.id, quantity: 1 },
                { headers: getHeaders() }
            );
            await fetchCart();
        } catch (error) {
            console.error("Add to Cart Error", error);
        }
    };

    const clearCart = async () => {
        try {
            const res = await axios.post(`${API_URL}/cart/clearCart`,
                { username },
                { headers: getHeaders() }
            );
            setCart({ id: res.data.id, items: res.data.items || [], total: res.data.total });
            setTotal(res.data.total);
        } catch (error) {
            console.error("Clear Cart Error", error);
        }
    };

    const submitOrder = async () => {
        try {
            await axios.post(`${API_URL}/order/submit/${username}`, '', { headers: getHeaders() });
            await clearCart();
            await fetchHistory(); // Refresh history immediately
        } catch (error) {
            console.error("Submit Order Error", error);
        }
    };

    const fetchHistory = useCallback(async () => {
        if (!username || !token) return;
        try {
            const res = await axios.get(`${API_URL}/order/history/${username}`, { headers: getHeaders() });
            setHistory(res.data);
        } catch (error) {
            console.error("History Error", error);
        }
    }, [username, token]);

    return { cart, total, history, loadingCart, fetchCart, addToCart, clearCart, submitOrder, fetchHistory };
};