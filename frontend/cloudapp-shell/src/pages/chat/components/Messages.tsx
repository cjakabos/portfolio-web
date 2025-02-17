import React, {useRef, useEffect, useState} from 'react';

const Messages = ({ messages, currentUser }) => {
    const messagesEndRef = useRef(null);

    // Function to scroll to the latest message
    const scrollToLatestMessage = () => {
        if (messagesEndRef.current) {
            // @ts-ignore
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Scroll to the latest message when messages change
    useEffect(() => {
        scrollToLatestMessage();
    }, [messages]);

    // Make sure messages are in order
    if (messages) messages.sort((a, b) => a.timestamp - b.timestamp)

    let renderMessage = (message) => {
        const { sender, content, timestamp } = message;
        const messageFromMe = currentUser === message.sender;
        const className = messageFromMe ? "Messages-message currentUser" : "Messages-message otherUser";

        // Convert the timestamp to a human-readable format
        const timestampString = new Date(timestamp).toLocaleString();

        return (
            <li className={className} key={message.id}>
                <span className="avatar" />
                <div className="Message-content">
                    <div className="username">{sender}</div>
                    <div className="text">{content}</div>
                    <div className="timestamp">{timestampString}</div>
                </div>
            </li>
        );
    };

    return (
        <ul className="messages-list">
            {messages &&
                messages.map((msg) => renderMessage(msg))}
            <div ref={messagesEndRef} /> {/* Ref to the last message */}
        </ul>
    );
};

export default Messages;
