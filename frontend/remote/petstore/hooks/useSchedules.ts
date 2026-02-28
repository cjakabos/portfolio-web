import { useState, useEffect } from "react";
import axios from "axios";
import type { Pet, Employee, Schedule } from "../types";

export const useSchedules = () => {
    const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
    const [allPets, setAllPets] = useState<Pet[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState(1);
    const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([""]);
    const [date, setDate] = useState(new Date());
    const [isModal1Open, setModal1Open] = useState(false);
    const [isModal2Open, setModal2Open] = useState(false);
    const [isModal3Open, setModal3Open] = useState(false);

    useEffect(() => {
            void getPets();
            void getSchedules();
    }, []);

    const handleOptionSelect = (event: { target: { options: HTMLOptionsCollection } }) => {
        for (let i = 0; i < event.target.options.length; i++) {
            if (event.target.options[i].selected) {
                setSelectedOption(Number(event.target.options[i].value));
            }
        }
    };

    const getPets = async () => {
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            const response = await axios.get(
                'http://localhost:80/petstore/pet',
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            setAllPets(response.data);
        } catch (error) {
            console.log("AXIOS ERROR: ", error);
        }
    };

    const handleAvailabilityFetch = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        getAvailability(date, selectedMultiOptions);
    };

    const getAvailability = async (dateString: Date, skills: string[]) => {

        const postData = {
            date: dateString,
            skills: skills
        };

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            const response = await axios.post(
                'http://localhost:80/petstore/user/employee/availability',
                postData,
                axiosConfig
            );
            console.log("getAvailability postData: ", postData);
            setAvailableEmployees(response.data);
            await getPets();
        } catch (error) {
            console.log("AXIOS ERROR: ", error);
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

    const scheduleSubmit = async (employeeId: string, petId: string, date: Date, selection: string[]) => {
        const postData = {
            employeeIds: [employeeId],
            petIds: [petId],
            date: new Date(date).toISOString(),
            activities: selection
        };

        console.log("scheduleSubmit postData", postData)

        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            const response = await axios.post(
                'http://localhost:80/petstore/schedule',
                postData,
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            await getSchedules();
        } catch (error) {
            console.log("AXIOS ERROR: ", postData);
        }
    };

    const getSchedules = async () => {
        setLoading(true);
        const axiosConfig = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
            withCredentials: true,
        };

        try {
            const response = await axios.get(
                'http://localhost:80/petstore/schedule',
                axiosConfig
            );
            console.log("RESPONSE RECEIVED: ", response.data);
            setSchedules(response.data);
            await getPets();
        } catch (error) {
            console.log("AXIOS ERROR: ", error);
        } finally {
            setLoading(false);
        }
    };

    return {
        availableEmployees,
        allPets,
        schedules,
        loading,
        selectedOption,
        selectedMultiOptions,
        date,
        isModal1Open,
        isModal2Open,
        isModal3Open,
        setDate,
        setModal1Open,
        setModal2Open,
        setModal3Open,
        handleOptionSelect,
        handleAvailabilityFetch,
        handleMultiSelect,
        scheduleSubmit,
        getAvailability
    };
};
