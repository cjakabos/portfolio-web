import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LatLng } from 'leaflet';

export interface Vehicle {
    id: string;
    condition: string;
    details: {
        model: string;
        manufacturer: { name: string; code: number };
        externalColor: string;
        body: string;
    };
    location: {
        lat: number;
        lon: number;
    };
}

export interface VehicleFormData {
    model: string;
    manufacturer: string;
    color: string;
    condition: string;
    lat: number;
    lon: number;
}

const INITIAL_FORM: VehicleFormData = {
    model: '',
    manufacturer: 'Volvo',
    color: '',
    condition: 'NEW',
    lat: 59.3282,
    lon: 18.0533
};

export const useVehicleMap = () => {
    // 1. Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(false);
    const [userToken, setUserToken] = useState('');

    // 2. UI/Modal State
    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<'CREATE' | 'UPDATE'>('CREATE');
    const [formData, setFormData] = useState<VehicleFormData>(INITIAL_FORM);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // 3. Map State
    const [center] = useState<[number, number]>([59.328246, 18.053383]);

    // Refs to prevent double firing
    const effectRan = useRef(false);

    // --- Helpers ---
    const getAxiosConfig = (token: string) => ({
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Authorization': token
        }
    });

    // --- API Actions ---
    const fetchVehicles = async (token: string) => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:80/vehicles/cars', getAxiosConfig(token));
            setVehicles(response.data);
        } catch (error) {
            console.error("AXIOS ERROR FETCH:", error);
        } finally {
            setLoading(false);
        }
    };

    const createVehicle = async () => {
        const payload = {
            condition: formData.condition,
            details: {
                body: "sedan",
                model: formData.model,
                manufacturer: { code: 101, name: formData.manufacturer },
                numberOfDoors: 4,
                fuelType: "Gasoline",
                engine: "2.0L",
                mileage: 0,
                modelYear: 2024,
                productionYear: 2024,
                externalColor: formData.color
            },
            location: { lat: formData.lat, lon: formData.lon }
        };

        try {
            await axios.post('http://localhost:80/vehicles/cars', payload, getAxiosConfig(userToken));
            fetchVehicles(userToken); // Refresh list
            setShowModal(false);
        } catch (error) {
            console.error("AXIOS ERROR POST:", error);
        }
    };

    const deleteVehicle = async (id: string) => {
        if(!window.confirm("Are you sure you want to delete this vehicle?")) return;

        try {
            await axios.delete(`http://localhost:80/vehicles/cars/${id}`, getAxiosConfig(userToken));
            setVehicles(prev => prev.filter(v => v.id !== id));
        } catch (error) {
            console.error("AXIOS ERROR DELETE:", error);
        }
    };

    // --- Event Handlers ---
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formMode === 'CREATE') {
            createVehicle();
        } else {
            // Add update logic here if API supports it
            console.log("Update not implemented in this mock", selectedId);
            setShowModal(false);
        }
    };

    const handleMapClick = (e: { latlng: LatLng }) => {
        // When map is clicked, open modal in CREATE mode with these coords
        setFormData(prev => ({
            ...prev,
            lat: Number(e.latlng.lat.toFixed(6)),
            lon: Number(e.latlng.lng.toFixed(6))
        }));
        setFormMode('CREATE');
        setShowModal(true);
    };

    const openCreate = () => {
        setFormMode('CREATE');
        setFormData(INITIAL_FORM);
        setShowModal(true);
    };

    const openEdit = (v: Vehicle) => {
        setFormMode('UPDATE');
        setSelectedId(v.id);
        setFormData({
            model: v.details.model,
            manufacturer: v.details.manufacturer.name,
            color: v.details.externalColor,
            condition: v.condition,
            lat: v.location.lat,
            lon: v.location.lon
        });
        setShowModal(true);
    };

    // --- Initialization ---
    useEffect(() => {
        if (!effectRan.current && typeof window !== "undefined") {
            const token = `Bearer ${localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")}` || '';
            setUserToken(token);
            effectRan.current = true;
            fetchVehicles(token);
        }
    }, []);

    return {
        vehicles,
        loading,
        center,
        showModal,
        setShowModal,
        formMode,
        formData,
        setFormData,
        handleFormSubmit,
        handleMapClick,
        deleteVehicle,
        openCreate,
        openEdit
    };
};