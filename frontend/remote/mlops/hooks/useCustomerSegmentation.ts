import { useState, useEffect, useCallback } from 'react';

// Types for the ML data response
interface SegmentMetadata {
    color: string;
    centroid_age?: number;
    centroid_income?: number;
    centroid_spending?: number;
}

interface MLData {
    spending_histogram: {
        data: number[];
        bins: number;
        title: string;
    };
    pairplot_data: {
        age: number[];
        annual_income: number[];
        spending_score: number[];
        gender: string[];
    };
    cluster_scatter: {
        pca_component_1: number[];
        pca_component_2: number[];
        segment: number[];
        customer_id: number[];
        n_clusters: number;
        title: string;
    };
    segment_metadata: Record<number, SegmentMetadata>;
}

interface Customer {
    id: number;
    gender: string;
    age: number;
    annual_income: number;
    spending_score: number;
    segment: number;
}

interface FormValues {
    age: string;
    annual_income: string;
    spending_score: string;
}

// API configuration - adjust these for your environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:80';
const API_PREFIX = '/mlops-segmentation';
const getJsonHeaders = () => ({ 'Content-Type': 'application/json' });

export function useCustomerSegmentation() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [mlData, setMlData] = useState<MLData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState('Female');
    const [sampleSize, setSampleSize] = useState<number>(-2);
    const [formValues, setFormValues] = useState<FormValues>({
        age: '30',
        annual_income: '50',
        spending_score: '50'
    });

    // Fetch ML info (raw data for visualizations)
    const fetchMLInfo = useCallback(async (size: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}${API_PREFIX}/getMLInfo`, {
                method: 'POST',
                headers: getJsonHeaders(),
                credentials: 'include',
                body: JSON.stringify({ sampleSize: size }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setMlData(data);
            setSampleSize(size);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch ML data';
            setError(message);
            console.error('Error fetching ML info:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch customer list
    const fetchCustomers = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}${API_PREFIX}/getSegmentationCustomers`, {
                method: 'GET',
                headers: getJsonHeaders(),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    }, []);

    // Add a new customer
    const addCustomer = useCallback(async (customerData: {
        gender: string;
        age: number;
        annual_income: number;
        spending_score: number;
        segment: number;
    }) => {
        try {
            const response = await fetch(`${API_BASE_URL}${API_PREFIX}/addCustomer`, {
                method: 'POST',
                headers: getJsonHeaders(),
                credentials: 'include',
                body: JSON.stringify({ fields: customerData }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Error adding customer:', err);
            throw err;
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        fetchMLInfo(-2); // -2 means just read current data without re-segmenting
        fetchCustomers();
    }, [fetchMLInfo, fetchCustomers]);

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormValues(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle gender selection
    const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedGender(e.target.value);
    };

    // Handle form submission (add customer and re-cluster)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Add the new customer
            await addCustomer({
                gender: selectedGender,
                age: parseInt(formValues.age),
                annual_income: parseInt(formValues.annual_income),
                spending_score: parseInt(formValues.spending_score),
                segment: 0 // Will be reassigned during re-segmentation
            });

            // Re-segment with new data (-1 means re-segment without reinitializing)
            await fetchMLInfo(-1);

            // Refresh customer list
            await fetchCustomers();

            // Reset form
            setFormValues({
                age: '30',
                annual_income: '50',
                spending_score: '50'
            });
        } catch (err) {
            console.error('Error submitting form:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle sample size button clicks
    const handleSampleClick = async (size: number) => {
        await fetchMLInfo(size);
        await fetchCustomers();
    };

    return {
        // Data
        customers,
        mlData,
        loading,
        error,

        // Form state
        formValues,
        selectedGender,
        sampleSize,

        // Handlers
        handleInputChange,
        handleGenderChange,
        handleSubmit,
        handleSampleClick,

        // Direct API methods (for advanced usage)
        fetchMLInfo,
        fetchCustomers,
        addCustomer
    };
}
