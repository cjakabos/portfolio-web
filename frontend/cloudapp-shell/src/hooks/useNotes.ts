import { useState, useCallback } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useNotes = (username: string, token: string) => {
    const [notes, setNotes] = useState<any[]>([]);
    const [loadingNotes, setLoading] = useState(false);

    // Helper to get headers
    const getHeaders = () => ({
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': token
    });

    const fetchNotes = useCallback(async () => {
        if (!username || !token) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/note/user/${username}`, { headers: getHeaders() });
            setNotes(res.data);
        } catch (error) {
            console.error("Fetch Notes Error", error);
        } finally {
            setLoading(false);
        }
    }, [username, token]);

    const addNote = async (title: string, description: string) => {
        try {
            await axios.post(`${API_URL}/note/addNote`,
                { user: username, title, description },
                { headers: getHeaders() }
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
                { headers: getHeaders() }
            );
            await fetchNotes();
        } catch (error) {
            console.error("Update Note Error", error);
        }
    };

    const deleteNote = async (id: number) => {
        try {
            await axios.get(`${API_URL}/note/delete/${id}`, { headers: getHeaders() });
            await fetchNotes();
        } catch (error) {
            console.error("Delete Note Error", error);
        }
    };

    return { notes, loadingNotes, fetchNotes, addNote, updateNote, deleteNote };
};