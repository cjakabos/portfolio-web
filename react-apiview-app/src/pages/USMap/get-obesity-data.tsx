import { useEffect, useState } from "react";
import { ObesityData } from "@/types/types";

function useGetObesityData() {
    const [dataResponse, setDataResponse] = useState<{
        data: ObesityData | null;
        isLoading: boolean;
    }>({
        data: null,
        isLoading: true,
    });

    useEffect(() => {
        const fetchObesityData = async () => {
            try {
                const url = 'https://obesity-us-backend.onrender.com/api/obesity';
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        mode: 'no-cors',
                    }
                });

                if (!response.ok) {
                    console.error(response);
                    throw new Error('API request failed');
                }
                const fetchedData = await response.json() as ObesityData;

                setDataResponse({
                    data: fetchedData,
                    isLoading: false,
                });
            } catch (error) {
                console.error(error);
                setDataResponse({
                    data: null,
                    isLoading: false,
                });
            }
        };

        void fetchObesityData();
    }, []);

    return dataResponse;
}

export default useGetObesityData;
