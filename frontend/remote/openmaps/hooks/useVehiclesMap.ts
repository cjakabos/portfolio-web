import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { LatLng } from 'leaflet';

type VehicleId = number | string;
export type VehicleCondition = 'NEW' | 'USED';

export interface ManufacturerOption {
    code: number;
    name: string;
}

export const MANUFACTURERS: ManufacturerOption[] = [
    { code: 100, name: 'Audi' },
    { code: 101, name: 'Chevrolet' },
    { code: 102, name: 'Ford' },
    { code: 103, name: 'BMW' },
    { code: 104, name: 'Dodge' }
];

export const BODY_OPTIONS = ['sedan', 'hatchback', 'wagon', 'suv', 'coupe', 'pickup', 'van'] as const;
export const FUEL_TYPE_OPTIONS = ['Gasoline', 'Diesel', 'Hybrid', 'Electric', 'Plug-in Hybrid'] as const;

export interface Vehicle {
    id: VehicleId;
    condition: VehicleCondition;
    details: {
        model: string;
        manufacturer: { name: string; code: number };
        externalColor: string;
        body: string;
        numberOfDoors?: number | null;
        fuelType?: string | null;
        engine?: string | null;
        mileage?: number | null;
        modelYear?: number | null;
        productionYear?: number | null;
    };
    location: {
        lat: number;
        lon: number;
    };
}

export interface VehicleFormData {
    model: string;
    manufacturerCode: number;
    body: string;
    color: string;
    condition: VehicleCondition;
    numberOfDoors: number;
    fuelType: string;
    engine: string;
    mileage: number;
    modelYear: number;
    productionYear: number;
    lat: number;
    lon: number;
}

const VEHICLES_API_URL = 'http://localhost:80/vehicles/cars';
const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_MANUFACTURER = MANUFACTURERS[0];

const INITIAL_FORM: VehicleFormData = {
    model: '',
    manufacturerCode: DEFAULT_MANUFACTURER.code,
    body: 'sedan',
    color: '',
    condition: 'NEW',
    numberOfDoors: 4,
    fuelType: 'Gasoline',
    engine: '',
    mileage: 0,
    modelYear: CURRENT_YEAR,
    productionYear: CURRENT_YEAR,
    lat: 59.3282,
    lon: 18.0533
};

const isVehicleCondition = (value: string): value is VehicleCondition => value === 'NEW' || value === 'USED';

const findManufacturerByCode = (code: number) =>
    MANUFACTURERS.find(manufacturer => manufacturer.code === code) ?? null;

const getManufacturerForVehicle = (vehicle: Vehicle) =>
    MANUFACTURERS.find(manufacturer => manufacturer.code === vehicle.details.manufacturer.code)
    ?? MANUFACTURERS.find(manufacturer => manufacturer.name === vehicle.details.manufacturer.name)
    ?? DEFAULT_MANUFACTURER;

const isFiniteNumber = (value: number) => Number.isFinite(value);

const isIntegerInRange = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;

const validateFormData = (formData: VehicleFormData): string | null => {
    if (!findManufacturerByCode(formData.manufacturerCode)) {
        return 'Please select a supported manufacturer.';
    }

    if (!isVehicleCondition(formData.condition)) {
        return 'Condition must be NEW or USED.';
    }

    if (!formData.model.trim()) {
        return 'Model is required.';
    }

    if (!formData.body.trim()) {
        return 'Body is required.';
    }

    if (!formData.color.trim()) {
        return 'Color is required.';
    }

    if (!formData.fuelType.trim()) {
        return 'Fuel type is required.';
    }

    if (!formData.engine.trim()) {
        return 'Engine is required.';
    }

    if (!isIntegerInRange(formData.numberOfDoors, 1, 8)) {
        return 'Number of doors must be an integer between 1 and 8.';
    }

    if (!isIntegerInRange(formData.mileage, 0, 2_000_000)) {
        return 'Mileage must be a whole number between 0 and 2,000,000.';
    }

    if (!isIntegerInRange(formData.modelYear, 1886, CURRENT_YEAR + 2)) {
        return `Model year must be between 1886 and ${CURRENT_YEAR + 2}.`;
    }

    if (!isIntegerInRange(formData.productionYear, 1886, CURRENT_YEAR + 2)) {
        return `Production year must be between 1886 and ${CURRENT_YEAR + 2}.`;
    }

    if (formData.productionYear > formData.modelYear) {
        return 'Production year cannot be greater than model year.';
    }

    if (!isFiniteNumber(formData.lat) || formData.lat < -90 || formData.lat > 90) {
        return 'Latitude must be between -90 and 90.';
    }

    if (!isFiniteNumber(formData.lon) || formData.lon < -180 || formData.lon > 180) {
        return 'Longitude must be between -180 and 180.';
    }

    return null;
};

const buildVehiclePayload = (formData: VehicleFormData) => {
    const manufacturer = findManufacturerByCode(formData.manufacturerCode) ?? DEFAULT_MANUFACTURER;

    return {
        condition: formData.condition,
        details: {
            body: formData.body.trim(),
            model: formData.model.trim(),
            manufacturer: {
                code: manufacturer.code,
                name: manufacturer.name
            },
            numberOfDoors: Math.trunc(formData.numberOfDoors),
            fuelType: formData.fuelType.trim(),
            engine: formData.engine.trim(),
            mileage: Math.trunc(formData.mileage),
            modelYear: Math.trunc(formData.modelYear),
            productionYear: Math.trunc(formData.productionYear),
            externalColor: formData.color.trim()
        },
        location: {
            lat: Number(formData.lat.toFixed(6)),
            lon: Number(formData.lon.toFixed(6))
        }
    };
};

const extractApiErrorMessage = (error: unknown, fallback: string) => {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error ? error.message : fallback;
    }

    if (typeof error.response?.data === 'string' && error.response.data.trim()) {
        return error.response.data;
    }

    const responseData = error.response?.data as
        | { message?: string; err_msg?: string }
        | undefined;

    return responseData?.message || responseData?.err_msg || error.message || fallback;
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
    const [selectedId, setSelectedId] = useState<VehicleId | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

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
            const response = await axios.get(VEHICLES_API_URL, getAxiosConfig(token));
            setVehicles(response.data);
        } catch (error) {
            console.error("AXIOS ERROR FETCH:", error);
        } finally {
            setLoading(false);
        }
    };

    const createVehicle = async () => {
        const payload = buildVehiclePayload(formData);

        await axios.post(VEHICLES_API_URL, payload, getAxiosConfig(userToken));
    };

    const updateVehicle = async () => {
        if (selectedId == null) {
            throw new Error('No vehicle selected for update.');
        }

        const payload = buildVehiclePayload(formData);

        await axios.put(`${VEHICLES_API_URL}/${selectedId}`, payload, getAxiosConfig(userToken));
    };

    const deleteVehicle = async (id: VehicleId) => {
        if(!window.confirm("Are you sure you want to delete this vehicle?")) return;

        try {
            await axios.delete(`${VEHICLES_API_URL}/${id}`, getAxiosConfig(userToken));
            setVehicles(prev => prev.filter(v => v.id !== id));
        } catch (error) {
            console.error("AXIOS ERROR DELETE:", error);
        }
    };

    // --- Event Handlers ---
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateFormData(formData);

        if (validationError) {
            setFormError(validationError);
            return;
        }

        setFormError(null);

        void (async () => {
            setSubmitting(true);
            try {
                if (formMode === 'CREATE') {
                    await createVehicle();
                } else {
                    await updateVehicle();
                }

                await fetchVehicles(userToken);
                setShowModal(false);
                setSelectedId(null);
            } catch (error) {
                setFormError(extractApiErrorMessage(error, 'Unable to save vehicle.'));
                console.error("AXIOS ERROR SAVE:", error);
            } finally {
                setSubmitting(false);
            }
        })();
    };

    const handleMapClick = (e: { latlng: LatLng }) => {
        // When map is clicked, open modal in CREATE mode with these coords
        setFormError(null);
        setFormData(prev => ({
            ...prev,
            lat: Number(e.latlng.lat.toFixed(6)),
            lon: Number(e.latlng.lng.toFixed(6))
        }));
        setFormMode('CREATE');
        setSelectedId(null);
        setShowModal(true);
    };

    const openCreate = () => {
        setFormMode('CREATE');
        setSelectedId(null);
        setFormError(null);
        setFormData(INITIAL_FORM);
        setShowModal(true);
    };

    const openEdit = (v: Vehicle) => {
        const manufacturer = getManufacturerForVehicle(v);

        setFormMode('UPDATE');
        setSelectedId(v.id);
        setFormError(null);
        setFormData({
            model: v.details.model,
            manufacturerCode: manufacturer.code,
            body: v.details.body || 'sedan',
            color: v.details.externalColor || '',
            condition: isVehicleCondition(v.condition) ? v.condition : 'USED',
            numberOfDoors: v.details.numberOfDoors ?? 4,
            fuelType: v.details.fuelType || 'Gasoline',
            engine: v.details.engine || '',
            mileage: v.details.mileage ?? 0,
            modelYear: v.details.modelYear ?? CURRENT_YEAR,
            productionYear: v.details.productionYear ?? v.details.modelYear ?? CURRENT_YEAR,
            lat: v.location.lat,
            lon: v.location.lon
        });
        setShowModal(true);
    };

    // --- Initialization ---
    useEffect(() => {
        if (!effectRan.current && typeof window !== "undefined") {
            const storedToken = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN");
            const token = storedToken ? `Bearer ${storedToken}` : '';
            setUserToken(token);
            effectRan.current = true;
            void fetchVehicles(token);
        }
    }, []);

    return {
        vehicles,
        loading,
        submitting,
        formError,
        center,
        showModal,
        setShowModal,
        formMode,
        formData,
        setFormData,
        manufacturers: MANUFACTURERS,
        bodyOptions: BODY_OPTIONS,
        fuelTypeOptions: FUEL_TYPE_OPTIONS,
        handleFormSubmit,
        handleMapClick,
        deleteVehicle,
        openCreate,
        openEdit
    };
};
