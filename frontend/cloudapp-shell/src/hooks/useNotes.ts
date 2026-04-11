import { useState, useCallback } from "react";
import { trackEvent } from "../lib/analytics/umami";
import { getCloudAppSessionClient } from "./cloudappClient";

export const useNotes = (username: string) => {
    const [notes, setNotes] = useState<any[]>([]);
    const [loadingNotes, setLoading] = useState(false);

    const fetchNotes = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        try {
            const res = await getCloudAppSessionClient().requestJson<any[]>(`/note/user/${username}`);
            setNotes(res ?? []);
        } catch (error) {
            console.error("Fetch Notes Error", error);
        } finally {
            setLoading(false);
        }
    }, [username]);

    const addNote = async (title: string, description: string) => {
        try {
            await getCloudAppSessionClient().requestVoid("/note/addNote", {
                method: "POST",
                body: { user: username, title, description },
            });
            trackEvent("notes_create", {
                title_length: title.length,
                description_length: description.length,
            });
            await fetchNotes(); // Refresh list
        } catch (error) {
            console.error("Add Note Error", error);
        }
    };

    const updateNote = async (id: number, title: string, description: string) => {
        try {
            await getCloudAppSessionClient().requestVoid("/note/updateNote", {
                method: "POST",
                body: { id, title, description },
            });
            trackEvent("notes_update", {
                note_id: id,
                title_length: title.length,
                description_length: description.length,
            });
            await fetchNotes();
        } catch (error) {
            console.error("Update Note Error", error);
        }
    };

    const deleteNote = async (id: number) => {
        try {
            await getCloudAppSessionClient().requestVoid(`/note/delete/${id}`, {
                method: "DELETE",
            });
            trackEvent("notes_delete", { note_id: id });
            await fetchNotes();
        } catch (error) {
            console.error("Delete Note Error", error);
        }
    };

    return { notes, loadingNotes, fetchNotes, addNote, updateNote, deleteNote };
};
