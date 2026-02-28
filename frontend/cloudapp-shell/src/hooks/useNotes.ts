import { useState, useCallback } from "react";
import axios from "axios";
import { getCloudAppCsrfHeaders } from "./cloudappCsrf";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
const JSON_HEADERS = {
    'Content-Type': 'application/json;charset=UTF-8',
};

const getRequestConfig = () => ({
    headers: JSON_HEADERS,
    withCredentials: true,
});

const getUnsafeRequestConfig = async () => ({
    headers: {
        ...(await getCloudAppCsrfHeaders(API_URL)),
        ...JSON_HEADERS,
    },
    withCredentials: true,
});

export const useNotes = (username: string) => {
    const [notes, setNotes] = useState<any[]>([]);
    const [loadingNotes, setLoading] = useState(false);

    const fetchNotes = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/note/user/${username}`, getRequestConfig());
            setNotes(res.data);
        } catch (error) {
            console.error("Fetch Notes Error", error);
        } finally {
            setLoading(false);
        }
    }, [username]);

    const addNote = async (title: string, description: string) => {
        try {
            await axios.post(`${API_URL}/note/addNote`,
                { user: username, title, description },
                await getUnsafeRequestConfig()
            );
            await fetchNotes(); // Refresh list
        } catch (error) {
            console.error("Add Note Error", error);
        }
    };

    const updateNote = async (id: number, title: string, description: string) => {
        try {
            await axios.post(`${API_URL}/note/updateNote`,
                { id, title, description },
                await getUnsafeRequestConfig()
            );
            await fetchNotes();
        } catch (error) {
            console.error("Update Note Error", error);
        }
    };

    const deleteNote = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/note/delete/${id}`, await getUnsafeRequestConfig());
            await fetchNotes();
        } catch (error) {
            console.error("Delete Note Error", error);
        }
    };

    return { notes, loadingNotes, fetchNotes, addNote, updateNote, deleteNote };
};
