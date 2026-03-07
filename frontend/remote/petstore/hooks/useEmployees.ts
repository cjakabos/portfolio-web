import { useState, useEffect } from "react";
import axios from "axios";
import type { Employee } from "../types";
import { getGatewayBaseUrl } from "./gatewayBaseUrl";

const PETSTORE_EMPLOYEE_URL = `${getGatewayBaseUrl()}/petstore/user/employee`;

const initialEmployee: Employee = {
    id: "",
    name: "",
    skills: [],
    daysAvailable: [],
};

export const useEmployees = () => {
    const [employee, setEmployee] = useState<Employee>(initialEmployee);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
    const [selectedDayOption, setSelectedDayOption] = useState(["MONDAY", "TUESDAY", "FRIDAY"]);

    useEffect(() => {
        void getEmployees();
    }, []);

    const handleEmployeeChange = (event: { target: { name: string; value: string } }) => {
        const { name, value } = event.target;
        setEmployee({
            ...employee,
            [name]: value,
        });
    };

    const handleEmployeeSubmit = async (e: { preventDefault: () => void }) => {
        e.preventDefault();

        const postData = {
            name: employee.name,
            skills: selectedMultiOptions,
            daysAvailable: selectedDayOption,
        };

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            await axios.post(
                PETSTORE_EMPLOYEE_URL,
                postData,
                axiosConfig
            );
            await getEmployees();
            // Reset form
            setEmployee(initialEmployee);
            setSelectedMultiOptions([]);
            setSelectedDayOption(["MONDAY", "TUESDAY", "FRIDAY"]);
        } catch (error: any) {
            console.error("Failed to create employee", error);
        }
    };

    const getEmployees = async () => {
        setLoading(true);
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            const response = await axios.get(
                PETSTORE_EMPLOYEE_URL,
                axiosConfig
            );
            setAllEmployees(response.data);
        } catch (error) {
            console.error("Failed to fetch employees", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMultiSelect = (event: { target: { options: HTMLOptionsCollection } }) => {
        const options = event.target.options;
        const valueTemp: string[] = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                valueTemp.push(options[i].value);
            }
        }
        setSelectedMultiOptions(valueTemp);
    };

    const handleDaysMultiSelect = (event: { target: { options: HTMLOptionsCollection } }) => {
        const options = event.target.options;
        const valueTemp: string[] = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                valueTemp.push(options[i].value);
            }
        }
        setSelectedDayOption(valueTemp);
    };

    return {
        employee,
        allEmployees,
        loading,
        selectedMultiOptions,
        selectedDayOption,
        handleEmployeeChange,
        handleEmployeeSubmit,
        handleMultiSelect,
        handleDaysMultiSelect,
    };
};
