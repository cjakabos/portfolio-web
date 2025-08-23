import React, { memo, useMemo } from "react";
import Markdown from "react-markdown";
import type { Message } from "ai";

export type ChatMessageProps = {
    message: Message;
    isLast: boolean;
};

function ChatMessage({ message, isLast }: ChatMessageProps) {

    const { thinkContent, cleanContent } = useMemo(() => {
        const getThinkContent = (content: string) => {
            const match = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
            return match ? match[1].trim() : null;
        };

        return {
            thinkContent: message.role === "assistant" ? getThinkContent(message.content) : null,
            cleanContent: message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim(),
        };
    }, [message.content, message.role]);

    const renderUserInput = () => (
        cleanContent && message.role === "user" && (
            <div className="inputFieldContainer">
                <div className="inputFieldFormat">
                    <Markdown>{cleanContent}</Markdown>
                </div>
            </div>
        )
    );

    const renderThinkingProcess = () => (
        thinkContent && message.role === "assistant" && (
            <details className="mb-2 text-sm" open>
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Reasoning process
                </summary>
                <div className="outputFieldThinkingFormat">
                    <Markdown>{thinkContent}</Markdown>
                </div>
            </details>
        )
    );

    const renderContent = () => (
        cleanContent && message.role === "assistant" && (
            <div className="mb-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Answer:
                </summary>
                <div className="outputFieldFormat">
                    <Markdown>{cleanContent}</Markdown>
                </div>
            </div>
        )
    );

    return (
        <div>
            {renderUserInput()}
            {renderThinkingProcess()}
            {renderContent()}
        </div>
    );
}

export default memo(ChatMessage, (prevProps, nextProps) => {
    if (nextProps.isLast) return false;
    return prevProps.isLast === nextProps.isLast && prevProps.message === nextProps.message;
});