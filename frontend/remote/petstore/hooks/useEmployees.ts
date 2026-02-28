import { useState, useEffect } from "react";
import axios from "axios";

const initialEmployee = {
    id: "",
    name: "",
    skills: [""],
    daysAvailable: [],
};

export const useEmployees = () => {
    const [employee, setEmployee] = useState(initialEmployee);
    const [allEmployees, setAllEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState(initialEmployee.skills);
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
            const response = await axios.post(
                'http://localhost:80/petstore/user/employee',
                postData,
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            await getEmployees();
            // Reset form
            setEmployee(initialEmployee);
            setSelectedMultiOptions([]);
            setSelectedDayOption(["MONDAY", "TUESDAY", "FRIDAY"]);
        } catch (error: any) {
            console.log("AXIOS ERROR: ", error.response);
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
                'http://localhost:80/petstore/user/employee',
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            setAllEmployees(response.data);
        } catch (error) {
            console.log("AXIOS ERROR: ", error);
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
