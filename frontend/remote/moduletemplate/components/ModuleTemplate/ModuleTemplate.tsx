"use client";
import React, {useEffect, useMemo, useRef, useState} from "react";

export default function ModuleTemplate() {

	const [userToken, setUserToken] = useState('');

	//Make sure only runs once
	const effectRan = useRef(false);
	if (!effectRan.current) {
		if (typeof window !== "undefined") {
			console.log(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN"))
			setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
			effectRan.current = true;
		}
	}


	return (
		<>
			Hello there
		</>
	);
}