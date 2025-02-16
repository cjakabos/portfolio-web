"use client"

import {useState, useRef, useEffect, useMemo} from "react"
import { useChat } from 'ai/react'
import ChatMessage from "./ChatMessage";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

export default function ChatLLM() {
	const [selectedOption, setSelectedOption] = useState("")
	const scrollAreaRef = useRef<HTMLDivElement>(null)

	const { messages, input, handleInputChange, handleSubmit: aiHandleSubmit } = useChat({api: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":5333/api/chat"})

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (input.trim()) {
			aiHandleSubmit(e)
			setSelectedOption("")
		}
	}

	useEffect(() => {
		aiHandleSubmit();
	}, [selectedOption]);

	useEffect(() => {
		if (scrollAreaRef.current) {
			// Scroll to the bottom of the messages list
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
		}
	}, [messages])

	return (
		<div className="flex items-center justify-center w-[80%] m-auto py-10 gap-10">
		<div className="Chat">
				<div ref={scrollAreaRef} className="messages-list">
					{messages.length <= 1 ? (
						<div className="flex flex-col items-center h-full text-left p-4">
							<div className="w-16 h-16 mb-4 text-primary" />
							<h1 className="text-2xl font-bold mb-2">Welcome to Local AI Chatbot - For full privacy</h1>
							<p className="text-muted-foreground mb-4">
								You can start to discuss below.
							</p>
						</div>
					) : (
						<>
							{messages.map((message, index) => (
								<ChatMessage
									key={message.id || index}
									message={message}
									isLast={index === messages.length - 1}
								/>
							))}
						</>
					)}
			</div>
			<div className="border-t">
				<div className="message-input text-black dark:text-white">
					<TextField
						className="inputField text-black dark:text-white"
						label="Type your message here..."
						placeholder="Enter your message and press ENTER"
						onChange={handleInputChange}
						margin="normal"
						value={input}
						onKeyPress={event => {
							if (event.key === 'Enter') {
								aiHandleSubmit();
							}
						}}
						inputProps={{ style: { color: 'blue' } }}
						InputLabelProps={{ style: { color: 'black' } }}
						style={{ height: "40px", width: "600px", marginRight: '10px'}}
					/>

					<button
						onClick={handleSubmit}
						className="chatButton">
						Send
					</button>
				</div>
			</div>
		</div>
		</div>
	)
}