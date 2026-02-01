import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// Define the shape of the data
export interface RegisterValues {
    firstname: "";
    lastname: "";
    username: "";
    password: "";
    confirmPassword: "";
}

export const useRegister = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errorType, setErrorType] = useState<"PASSWORD_MISMATCH" | "API_ERROR" | null>(null);

    const register = async (values: any) => {
        console.log("register init")
        setLoading(true);
        setErrorType(null);
        // 1. Client-side Validation
        if (values.password !== values.confirmPassword) {
            setErrorType("PASSWORD_MISMATCH");
            setLoading(false);
            return;
        }

        // 2. Prepare Data (exclude confirmPassword if API doesn't want it)
        const postData = {
            firstname: values.firstname,
            lastname: values.lastname,
            username: values.username,
            password: values.password,
            confirmPassword: values.confirmPassword,
        };

        console.log("register postData", postData)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80/cloudapp";
            
            const response = await axios.post(
                `${API_URL}/user/user-register`, 
                postData, 
                { headers: { 'Content-Type': 'application/json;charset=UTF-8' } }
            );
            
        } catch (error) {
            console.error("Registration Error", error);
            setErrorType("API_ERROR");
        } finally {
            setLoading(false);
        }
    };

    return { register, loading, errorType };
};