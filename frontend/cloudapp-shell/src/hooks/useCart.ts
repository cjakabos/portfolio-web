import { useState, useCallback } from "react";
import { Item, Cart } from '../../types';
import { trackEvent } from "../lib/analytics/umami";
import { getCloudAppSessionClient } from "./cloudappClient";

export const useCart = (username: string) => {
    const [cart, setCart] = useState<Cart>({id: 1, items: [], total: 0 });
    const [total, setTotal] = useState<any>(null); // Depending on API, might be string or obj
    const [history, setHistory] = useState<any[]>([]);
    const [loadingCart, setLoading] = useState(false);

    const fetchCart = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        try {
            const res = await getCloudAppSessionClient().requestJson<any>("/cart/getCart", {
                method: "POST",
                body: { username },
            });
            if (res) {
                setCart({ id: res.id, items: res.items || [], total: res.total });
                setTotal(res.total);
            }
        } catch (error) {
            console.error("Fetch Cart Error", error);
        } finally {
            setLoading(false);
        }
    }, [username]);

    const addToCart = async (item: any) => {
        try {
            await getCloudAppSessionClient().requestVoid("/cart/addToCart", {
                method: "POST",
                body: { username, itemId: item.id, quantity: 1 },
            });
            trackEvent("shop_add_to_cart", {
                item_id: item.id,
                price: item.price,
            });
            await fetchCart();
        } catch (error) {
            console.error("Add to Cart Error", error);
        }
    };

    const clearCart = async () => {
        try {
            const res = await getCloudAppSessionClient().requestJson<any>("/cart/clearCart", {
                method: "POST",
                body: { username },
            });
            trackEvent("shop_cart_clear", {
                item_count: cart.items.length,
                total: cart.total,
            });
            setCart({ id: res.id, items: res.items || [], total: res.total });
            setTotal(res.total);
        } catch (error) {
            console.error("Clear Cart Error", error);
        }
    };

    const submitOrder = async () => {
        try {
            await getCloudAppSessionClient().requestVoid(`/order/submit/${username}`, {
                method: "POST",
            });
            trackEvent("shop_checkout_submit", {
                item_count: cart.items.length,
                total: cart.total,
            });
            await clearCart();
            await fetchHistory(); // Refresh history immediately
        } catch (error) {
            console.error("Submit Order Error", error);
        }
    };

    const fetchHistory = useCallback(async () => {
        if (!username) return;
        try {
            const res = await getCloudAppSessionClient().requestJson<any[]>(`/order/history/${username}`);
            setHistory(res ?? []);
        } catch (error) {
            console.error("History Error", error);
        }
    }, [username]);

    return { cart, total, history, loadingCart, fetchCart, addToCart, clearCart, submitOrder, fetchHistory };
};
