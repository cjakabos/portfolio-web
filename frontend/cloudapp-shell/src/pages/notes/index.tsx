import React, { useEffect, useState } from 'react';
import { Note } from '../../../types';
import { Plus, Trash2, FileText, Pencil, X } from 'lucide-react';
import { useAuth } from "../../hooks/useAuth";
import { useNotes } from "../../hooks/useNotes";

const Notes: React.FC = () => {
    const { username, isReady } = useAuth();
    const { notes, fetchNotes, addNote, updateNote, deleteNote } = useNotes(username);

    // -- State --
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', description: '' });
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [editFormData, setEditFormData] = useState({ title: '', description: '' });

    // -- Sorting Logic --
    // We create a copy [...notes] to avoid mutating the original state
    // sort((a, b) => b.id - a.id) sorts by ID Descending (Newest first)
    // sort((a, b) => a.id - b.id) would sort by ID Ascending (Oldest first)
    const sortedNotes = [...notes].sort((a, b) => b.id - a.id);

    useEffect(() => {
        if (isReady && username) {
            fetchNotes();
        }
    }, [isReady, username, fetchNotes]);

    // -- Handlers --
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await addNote(formData.title, formData.description);
        setFormData({ title: '', description: '' });
        setShowForm(false);
        fetchNotes();
    };

    const handleEditClick = (note: Note) => {
        setEditingNote(note);
        setEditFormData({ title: note.title, description: note.description });
    };

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNote) return;

        await updateNote(editingNote.id, editFormData.title, editFormData.description);

        setEditingNote(null);
        setEditFormData({ title: '', description: '' });
        // No need to fetchNotes() here if your updateNote implementation already calls it,
        // but keeping it safe if the hook doesn't auto-fetch.
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this note?")) {
            await deleteNote(id);
            fetchNotes();
        }
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Notes</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-600 transition"
                >
                    <Plus size={18} /> Add Note
                </button>
            </div>

            {/* Inline Add Form */}
            {showForm && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Note</h3>
                        <input
                            type="text"
                            placeholder="Note Title"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                        <textarea
                            placeholder="Note Content"
                            rows={4}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Save</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Notes Grid - Using sortedNotes here */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedNotes.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-400">
                        No notes found. Create one!
                    </div>
                ) : (
                    sortedNotes.map(note => (
                        <div key={note.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col group hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg text-yellow-600 dark:text-yellow-500 mb-3">
                                    <FileText size={20} />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditClick(note)}
                                        className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(note.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">{note.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{note.description}</p>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Overlay */}
            {editingNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Note</h3>
                            <button
                                onClick={() => setEditingNote(null)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                                    value={editFormData.title}
                                    onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    rows={5}
                                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                                    value={editFormData.description}
                                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingNote(null)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                                >
                                    Update Note
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notes;
