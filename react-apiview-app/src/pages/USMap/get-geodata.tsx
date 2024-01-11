import { useEffect, useState } from "react";

function useGetGeoData() {
    const [dataResponse, setDataResponse] = useState<{
        data: null;
        isLoading: boolean;
    }>({
        data: null,
        isLoading: true,
    });

    useEffect(() => {
        const fetchGeoData = async () => {
            try {
                const url = 'https://obesity-us-backend.onrender.com/api/all';
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
                const fetchedData = await response.json() as GeoJSON;

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

        void fetchGeoData();
    }, []);

    return dataResponse;
}

export default useGetGeoData;
