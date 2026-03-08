import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, File as FileIcon, Trash2, Download, Plus, FileText, Pencil, X, Folder, ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnDef, createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { Note } from '../../types';
import { useAuth } from '../hooks/useAuth';
import { useFiles } from '../hooks/useFiles';
import { useNotes } from '../hooks/useNotes';

interface FilesNotesWorkspaceProps {
  defaultPanel?: 'files' | 'notes';
}

interface FileRow {
  rowId: string;
  fileId: number;
  name: string;
  downloadName: string;
  fileSize: string;
  contentType: string;
}

const columnHelper = createColumnHelper<FileRow>();

const panelHeaderClassName = 'p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-900';
const panelTitleClassName = 'min-w-0 flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white';
const panelActionButtonClassName = 'shrink-0 inline-flex h-11 w-11 sm:w-32 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition';

const FilesNotesWorkspace: React.FC<FilesNotesWorkspaceProps> = ({ defaultPanel = 'files' }) => {
  const { username, isReady } = useAuth();
  const { files, loadingFiles, fetchFiles, uploadFile, downloadFile, deleteFile } = useFiles(username);
  const { notes, fetchNotes, addNote, updateNote, deleteNote } = useNotes(username);

  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '' });
  const [mobilePanel, setMobilePanel] = useState<'files' | 'notes'>(defaultPanel);
  const [isDesktopViewport, setIsDesktopViewport] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  useEffect(() => {
    setMobilePanel(defaultPanel);
  }, [defaultPanel]);

  useEffect(() => {
    if (isReady && username) {
      fetchFiles();
      fetchNotes();
    }
  }, [fetchFiles, fetchNotes, isReady, username]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) {
      return;
    }

    setUploading(true);
    try {
      await uploadFile(event.target.files[0]);
      await fetchFiles();
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteFile = useCallback(async (fileId: number) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    await deleteFile(fileId);
    await fetchFiles();
  }, [deleteFile, fetchFiles]);

  const handleSubmitNote = async (event: React.FormEvent) => {
    event.preventDefault();
    await addNote(formData.title, formData.description);
    setFormData({ title: '', description: '' });
    setShowForm(false);
    await fetchNotes();
  };

  const handleEditClick = (note: Note) => {
    setEditingNote(note);
    setEditFormData({ title: note.title, description: note.description });
  };

  const handleUpdateNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingNote) {
      return;
    }

    await updateNote(editingNote.id, editFormData.title, editFormData.description);
    setEditingNote(null);
    setEditFormData({ title: '', description: '' });
    await fetchNotes();
  };

  const handleDeleteNote = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    await deleteNote(id);
    await fetchNotes();
  };

  const tableData = useMemo<FileRow[]>(() => files.map((file, index) => {
    const rawId = file.fileId ?? file.id ?? index + 1;
    const safeFileId = typeof rawId === 'number' ? rawId : Number(rawId) || index + 1;
    const displayName = file.fileName || file.name || `File ${index + 1}`;

    return {
      rowId: `${safeFileId}-${index}`,
      fileId: safeFileId,
      name: displayName,
      downloadName: file.name || displayName,
      fileSize: file.fileSize || 'Unknown',
      contentType: file.contentType || 'Unknown',
    };
  }), [files]);

  const columns = useMemo<ColumnDef<FileRow>[]>(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <FileIcon className="text-blue-400 shrink-0" size={20} />
          <span className="font-medium text-gray-900 dark:text-white break-words">{row.original.name}</span>
        </div>
      ),
    }),
    columnHelper.accessor('fileSize', {
      header: 'Size',
    }),
    columnHelper.accessor('contentType', {
      header: 'Type',
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => downloadFile(row.original.fileId, row.original.downloadName)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
            title="Download"
            aria-label={`Download ${row.original.name}`}
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteFile(row.original.fileId)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400"
            title="Delete"
            aria-label={`Delete ${row.original.name}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    }),
  ], [downloadFile, handleDeleteFile]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.id - a.id), [notes]);

  const filesExpanded = mobilePanel === 'files';
  const notesExpanded = mobilePanel === 'notes';

  const renderFilesContent = () => {
    if (loadingFiles) {
      return <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Loading files...</div>;
    }

    if (tableData.length === 0) {
      return <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">No files uploaded yet.</div>;
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase ${
                        header.column.id === 'actions' ? 'text-right' : ''
                      }`}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.original.rowId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-6 py-4 text-sm text-gray-600 dark:text-gray-300 ${
                        cell.column.id === 'actions' ? 'text-right' : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {table.getRowModel().rows.map((row) => (
            <div key={`mobile-${row.original.rowId}`} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <FileIcon className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white break-words">{row.original.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{row.original.contentType}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Size</span>
                <span className="text-gray-700 dark:text-gray-200">{row.original.fileSize}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => downloadFile(row.original.fileId, row.original.downloadName)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(row.original.fileId)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNotesContent = () => (
    <div className="space-y-4 relative">
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmitNote} className="space-y-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sortedNotes.length === 0 ? (
          <div className="xl:col-span-2 text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-400">
            No notes found. Create one!
          </div>
        ) : (
          sortedNotes.map((note) => (
            <div key={note.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg text-yellow-600 dark:text-yellow-500 mb-3">
                  <FileText size={20} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditClick(note)}
                    className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
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

      {editingNote && (
        <div className="fixed inset-0 z-[5000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingNote(null)} aria-hidden="true" />
          <div
            className="absolute inset-0 flex items-start justify-center p-2 sm:p-4"
            style={{
              paddingTop: 'max(5rem, env(safe-area-inset-top))',
              paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
              paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
              paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Note</h3>
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateNote} className="p-6 space-y-4">
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
        </div>
      )}
    </div>
  );

  const uploadButton = (
    <label className={`${panelActionButtonClassName} bg-blue-600 text-white hover:bg-blue-700 cursor-pointer`}>
      <Upload size={16} />
      <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Upload'}</span>
      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
    </label>
  );

  const addNoteButton = (
    <button
      type="button"
      onClick={() => setShowForm(true)}
      className={`${panelActionButtonClassName} bg-yellow-500 text-white hover:bg-yellow-600`}
    >
      <Plus size={16} />
      <span className="hidden sm:inline">Add Note</span>
    </button>
  );

  return (
    <div className="relative isolate h-full min-h-0 p-4">
      {isDesktopViewport ? (
        <div className="flex h-full min-h-0 flex-row gap-4 xl:gap-6">
          <section className="min-w-0 flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className={panelHeaderClassName}>
              <div className={panelTitleClassName}>
                <Folder className="h-5 w-5 text-blue-600" />
                <span className="truncate">Files</span>
              </div>
              {uploadButton}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
              {renderFilesContent()}
            </div>
          </section>

          <section className="min-w-0 flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className={panelHeaderClassName}>
              <div className={panelTitleClassName}>
                <FileText className="h-5 w-5 text-yellow-500" />
                <span className="truncate">Notes</span>
              </div>
              {addNoteButton}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
              {renderNotesContent()}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <section className={`w-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0 ${filesExpanded ? 'flex-1' : 'shrink-0'}`}>
            <div className={panelHeaderClassName}>
              <button
                type="button"
                onClick={() => setMobilePanel(current => current === 'files' ? 'notes' : 'files')}
                className="flex flex-1 items-center justify-between text-left min-w-0"
              >
                <span className={panelTitleClassName}>
                  <Folder className="h-5 w-5 text-blue-600" />
                  <span className="truncate">Files</span>
                </span>
                <span className="text-gray-400">{filesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
              </button>
              {uploadButton}
            </div>
            {filesExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
                {renderFilesContent()}
              </div>
            )}
          </section>

          <section className={`w-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0 ${notesExpanded ? 'flex-1' : 'shrink-0'}`}>
            <div className={panelHeaderClassName}>
              <button
                type="button"
                onClick={() => setMobilePanel(current => current === 'notes' ? 'files' : 'notes')}
                className="flex flex-1 items-center justify-between text-left min-w-0"
              >
                <span className={panelTitleClassName}>
                  <FileText className="h-5 w-5 text-yellow-500" />
                  <span className="truncate">Notes</span>
                </span>
                <span className="text-gray-400">{notesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
              </button>
              {addNoteButton}
            </div>
            {notesExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
                {renderNotesContent()}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default FilesNotesWorkspace;
