
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, File as FileIcon, Trash2, Download } from 'lucide-react';
import { ColumnDef, createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useAuth } from "../../hooks/useAuth";
import { useFiles } from "../../hooks/useFiles";

interface FileRow {
  rowId: string;
  fileId: number;
  name: string;
  downloadName: string;
  fileSize: string;
  contentType: string;
}

const columnHelper = createColumnHelper<FileRow>();

const CloudFiles: React.FC = () => {
  const { username, isReady } = useAuth();
  const { files, loadingFiles, fetchFiles, uploadFile, downloadFile, deleteFile } = useFiles(username);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isReady && username) {
      fetchFiles();
    }
  }, [isReady, username, fetchFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        await uploadFile(e.target.files[0]);
        await fetchFiles();
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = useCallback(
    async (fileId: number) => {
      if (window.confirm("Are you sure you want to delete this file?")) {
        await deleteFile(fileId);
        await fetchFiles();
      }
    },
    [deleteFile, fetchFiles]
  );

  const tableData = useMemo<FileRow[]>(
    () =>
      files.map((file, index) => {
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
      }),
    [files]
  );

  const columns = useMemo<ColumnDef<FileRow>[]>(
    () => [
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
              onClick={() => handleDelete(row.original.fileId)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400"
              title="Delete"
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ),
      }),
    ],
    [downloadFile, handleDelete]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Files</h2>
        <label className="bg-blue-600 cursor-pointer text-white px-4 py-2 rounded-lg flex min-h-[44px] items-center gap-2 hover:bg-blue-700 transition">
          <Upload size={18} />
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loadingFiles ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">Loading files...</div>
        ) : tableData.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No files uploaded yet.</div>
        ) : (
          <>
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
                      onClick={() => handleDelete(row.original.fileId)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CloudFiles;
