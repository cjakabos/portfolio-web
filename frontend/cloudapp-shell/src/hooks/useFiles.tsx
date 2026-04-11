import { useState, useCallback } from "react";
import { trackEvent } from "../lib/analytics/umami";
import { getCloudAppSessionClient } from "./cloudappClient";

export const useFiles = (username: string) => {
    const [files, setFiles] = useState<any[]>([]);
    const [loadingFiles, setLoading] = useState(false);

    const fetchFiles = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        try {
            const res = await getCloudAppSessionClient().requestJson<any[]>(`/file/user/${username}`);
            setFiles(res ?? []);
        } catch (error) {
            console.error("Fetch Files Error", error);
        } finally {
            setLoading(false);
        }
    }, [username]);

    const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append('fileUpload', file);
        formData.append('username', username);

        try {
            await getCloudAppSessionClient().requestVoid("/file/upload", {
                method: "POST",
                body: formData,
            });
            trackEvent("files_upload", {
                content_type: file.type || "unknown",
                extension: file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "unknown" : "none",
                size_bytes: file.size,
            });
            await fetchFiles();
        } catch (error) {
            console.error("Upload Error", error);
        }
    };

    const deleteFile = async (id: number) => {
        try {
            await getCloudAppSessionClient().requestVoid(`/file/delete-file/${id}`, {
                method: "DELETE",
            });
            trackEvent("files_delete", { file_id: id });
            await fetchFiles();
        } catch (error) {
            console.error("Delete File Error", error);
        }
    };

    const downloadFile = async (id: number, fileName: string) => {
        try {
            const blob = await getCloudAppSessionClient().requestBlob(`/file/get-file/${id}`);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            trackEvent("files_download", {
                file_id: id,
                filename_length: fileName.length,
            });
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
