import { useState, useCallback } from "react";
import { trackEvent } from "../lib/analytics/umami";
import { getCloudAppSessionClient } from "./cloudappClient";

export const useItems = () => {
    const [items, setItems] = useState<any[]>([]);
    const [loadingItems, setLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCloudAppSessionClient().requestJson<any[]>("/item");
            setItems(res ?? []);
        } catch (error) {
            console.error("Fetch Items Error", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const createItem = async (name: string, price: string, description: string) => {
        try {
            await getCloudAppSessionClient().requestVoid("/item", {
                method: "POST",
                body: { name, price, description },
            });
            trackEvent("shop_item_create", {
                name_length: name.length,
                price: Number(price),
                description_length: description.length,
            });
            await fetchItems(); // Refresh list
            return true;
        } catch (error) {
            console.error("Create Item Error", error);
            return false;
        }
    };

    return { items, loadingItems, fetchItems, createItem };
};
