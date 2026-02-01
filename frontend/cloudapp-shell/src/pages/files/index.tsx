
import React, { useEffect, useState } from 'react';
import { Upload, File as FileIcon, Trash2, Download } from 'lucide-react';
import { useAuth } from "../../hooks/useAuth";
import { useFiles } from "../../hooks/useFiles";

const CloudFiles: React.FC = () => {
    const { token, username, isReady } = useAuth();
  const { files, loadingFiles, fetchFiles, uploadFile, downloadFile, deleteFile } = useFiles(username, token);
  const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (token && username) {
            fetchFiles();
        }
    }, [token, username]);

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

  const handleDelete = async (fileId: number) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
        await deleteFile(fileId);
        fetchFiles();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Files</h2>
        <label className="bg-blue-600 cursor-pointer text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition">
           <Upload size={18} />
           {uploading ? 'Uploading...' : 'Upload File'}
           <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Size</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {files.map(file => (
              <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-6 py-4">
                   <div className="flex items-center gap-3">
                      <FileIcon className="text-blue-400" size={20} />
                      <span className="font-medium text-gray-900 dark:text-white">{file.fileName}</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{file.fileSize}</td>
                <td className="px-6 py-4 text-sm text-gray-400">{file.contentType}</td>
                <td className="px-6 py-4 text-right flex gap-3 justify-end">
                  <button onClick={() => downloadFile(file.fileId, file.name)}  className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Download (Mock)">
                    <Download size={18} />
                  </button>
                  <button onClick={() => handleDelete(file.fileId)} className="text-gray-400 hover:text-red-600" title="Delete">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No files uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CloudFiles;
