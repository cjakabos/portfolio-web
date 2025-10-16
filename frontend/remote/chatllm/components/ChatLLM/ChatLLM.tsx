"use client"

import {useState, useRef, useEffect, useMemo} from "react"
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import ChatMessage from "./ChatMessage";
import TextField from '@mui/material/TextField';

export default function ChatLLM() {
	const [selectedOption, setSelectedOption] = useState("")
	const scrollAreaRef = useRef<HTMLDivElement>(null)

    // Chat state
    const {
        messages,
        setMessages,
        sendMessage,
        stop,
        status
    } = useChat({
        transport: new DefaultChatTransport({
            api: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":5333/api/chat"
        }),
    });

    const [input, setInput] = useState('');


    const handleSubmit = e => {
        e.preventDefault();
        sendMessage({ text: input });
        setInput('');
        setSelectedOption("");
    };


	useEffect(() => {
		if (scrollAreaRef.current) {
			// Scroll to the bottom of the messages list
			scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
		}
	}, [messages])

	return (
		<div className="flex items-center justify-center h-[90%] w-[70%] m-auto py-10 gap-10">
		<div className="Chat">
				<div ref={scrollAreaRef} className="messages-list">
					{messages.length <= 0 ? (
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
						onChange={e => setInput(e.target.value)}
						margin="normal"
						value={input}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                handleSubmit(event);
                            }
                        }}
						inputProps={{ style: { color: 'blue' } }}
						InputLabelProps={{ style: { color: 'black' } }}
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