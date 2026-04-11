import { useState } from "react";
import { getCloudAppBrowserClient } from "./cloudappClient";

// Define the shape of the data
export interface RegisterValues {
    firstname: "";
    lastname: "";
    username: "";
    password: "";
    confirmPassword: "";
}

export const useRegister = () => {
    const [loading, setLoading] = useState(false);
    const [errorType, setErrorType] = useState<"PASSWORD_MISMATCH" | "API_ERROR" | null>(null);

    const register = async (values: any) => {
        setLoading(true);
        setErrorType(null);
        // 1. Client-side Validation
        if (values.password !== values.confirmPassword) {
            setErrorType("PASSWORD_MISMATCH");
            setLoading(false);
            return false;
        }

        // 2. Prepare Data (exclude confirmPassword if API doesn't want it)
        const postData = {
            firstname: values.firstname,
            lastname: values.lastname,
            username: (values.username ?? "").trim().toLowerCase(),
            password: values.password,
            confirmPassword: values.confirmPassword,
        };
        try {
            await getCloudAppBrowserClient().requestJson(
                "/user/user-register",
                {
                    method: "POST",
                    body: postData,
                }
            );
            return true;
        } catch (error) {
            console.error("Registration Error", error);
            setErrorType("API_ERROR");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { register, loading, errorType };
};
