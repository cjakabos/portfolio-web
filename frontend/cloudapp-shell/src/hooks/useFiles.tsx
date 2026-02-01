import { useState, useCallback } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";

export const useFiles = (username: string, token: string) => {
    const [files, setFiles] = useState<any[]>([]);
    const [loadingFiles, setLoading] = useState(false);

    const fetchFiles = useCallback(async () => {
        if (!username || !token) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/file/user/${username}`, {
                headers: { 'Authorization': token }
            });
            setFiles(res.data);
        } catch (error) {
            console.error("Fetch Files Error", error);
        } finally {
            setLoading(false);
        }
    }, [username, token]);

    const uploadFile = async (file: File) => {
        console.log("dilw",file)
        const formData = new FormData();
        formData.append('fileUpload', file);
        formData.append('username', username);

        try {
            await axios.post(`${API_URL}/file/upload`, formData, {
                headers: {
                    "Authorization": token,
                    "Content-type": "multipart/form-data"
                },
            });
            await fetchFiles();
        } catch (error) {
            console.error("Upload Error", error);
        }
    };

    const deleteFile = async (id: number) => {
        try {
            await axios.get(`${API_URL}/file/delete-file/${id}`, {
                headers: { 'Authorization': token }
            });
            await fetchFiles();
        } catch (error) {
            console.error("Delete File Error", error);
        }
    };

    const downloadFile = async (id: number, fileName: string) => {
        try {
            const response = await fetch(`${API_URL}/file/get-file/${id}`, {
                method: 'GET',
                headers: { 'Authorization': token }
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error("Download Error", error);
        }
    };

    return { files, loadingFiles, fetchFiles, uploadFile, deleteFile, downloadFile };
};