"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from 'ai/react'
import Markdown from "react-markdown";

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
		<div className="Chat">
				<div ref={scrollAreaRef} className="messages-list">
					{messages.length <= 1 ? (
						<div className="flex flex-col items-center justify-left h-full text-left p-4">
							<div className="w-16 h-16 mb-4 text-primary" />
							<h1 className="text-2xl font-bold mb-2">Welcome to Local AI Chatbot - For full privacy</h1>
							<p className="text-muted-foreground mb-4">
								You can start to discuss below.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-4 p-4">
								{messages.map((message, index) => (
									message.role !== 'system' && (
										<div
											key={message.id}
											className={`flex ${
												message.role === "user" ? "justify-end" : "justify-start"
											}`}
										>
											<div
												className={`rounded-lg p-4 max-w-[80%] ${
													message.role === "user"
														? "bg-primary text-primary-foreground"
														: "bg-muted"
												}`}
											>
												<Markdown>{message.content}</Markdown>
											</div>
										</div>
									)
								))}
						</div>
					)}
			</div>
			<div className="border-t">
				<form onSubmit={handleSubmit} className="flex gap-2 p-4 mb-10">
					<input
						type="text"
						value={input}
						onChange={handleInputChange}
						placeholder="Type your message..."
						className="flex-grow"
					/>
					<button className="submitbutton" type="submit">
						Send message
					</button>
				</form>
			</div>
		</div>
	)
}