import { useState, useCallback } from "react";
import axios from "axios";
import { Item, Cart } from '../../types';
import { getCloudAppCsrfHeaders } from "./cloudappCsrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useCart = (username: string) => {
    const [cart, setCart] = useState<Cart>({id: 1, items: [], total: 0 });
    const [total, setTotal] = useState<any>(null); // Depending on API, might be string or obj
    const [history, setHistory] = useState<any[]>([]);
    const [loadingCart, setLoading] = useState(false);

    const getHeaders = () => ({
        'Content-Type': 'application/json;charset=UTF-8',
    });

    const getRequestConfig = () => ({
        headers: getHeaders(),
        withCredentials: true,
    });

    const getUnsafeRequestConfig = async () => ({
        headers: {
            ...(await getCloudAppCsrfHeaders(API_URL)),
            ...getHeaders(),
        },
        withCredentials: true,
    });

    const fetchCart = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/cart/getCart`,
                { username },
                await getUnsafeRequestConfig()
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
    }, [username]);

    const addToCart = async (item: any) => {
        try {
            await axios.post(`${API_URL}/cart/addToCart`,
                { username, itemId: item.id, quantity: 1 },
                await getUnsafeRequestConfig()
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
                await getUnsafeRequestConfig()
            );
            setCart({ id: res.data.id, items: res.data.items || [], total: res.data.total });
            setTotal(res.data.total);
        } catch (error) {
            console.error("Clear Cart Error", error);
        }
    };

    const submitOrder = async () => {
        try {
            await axios.post(`${API_URL}/order/submit/${username}`, '', await getUnsafeRequestConfig());
            await clearCart();
            await fetchHistory(); // Refresh history immediately
        } catch (error) {
            console.error("Submit Order Error", error);
        }
    };

    const fetchHistory = useCallback(async () => {
        if (!username) return;
        try {
            const res = await axios.get(`${API_URL}/order/history/${username}`, getRequestConfig());
            setHistory(res.data);
        } catch (error) {
            console.error("History Error", error);
        }
    }, [username]);

    return { cart, total, history, loadingCart, fetchCart, addToCart, clearCart, submitOrder, fetchHistory };
};
