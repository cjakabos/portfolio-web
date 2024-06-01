import {useEffect, useRef, useState} from "react";
import Axios from "axios";

export function useThisApi() {
    const [Name, setName] = useState("")

    useEffect(() => {
        Axios.get('https://api.adviceslip.com/advice')
            .then(response => {
                setName(response.data.slip.advice)
            })
    }, [])

    return Name;
}

