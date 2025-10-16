'use client';
import Markdown from "react-markdown";
import type { UIMessage } from "ai";

export type ChatMessageProps = {
    message: UIMessage;
    isLast: boolean;
};

export default function ChatMessage({ message, isLast }: ChatMessageProps) {

    return (
        <div>
            <div
            >
                {message.parts.map((part, partIndex) => {
                    if (part.type === "text" && message.role === "user") {

                        return (
                            <div className="inputFieldContainer">
                                <div className="inputFieldFormat">
                                    <Markdown>{part.text}</Markdown>
                                </div>
                            </div>
                        );
                    }

                    if (part.type === "reasoning") {
                        return (
                            <details className="mb-2 text-sm" open>
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Reasoning process
                                </summary>
                                <div className="outputFieldThinkingFormat">
                                    <Markdown>{part.text}</Markdown>
                                </div>
                            </details>
                        );
                    }


                })}
                {message.parts.map((part, partIndex) => {

                    if (part.type === "text" && message.role === "assistant" && part.text != "") {
                        return (
                            <div className="mb-2 text-sm">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Answer:
                                </summary>
                                <div className="outputFieldFormat">
                                    <Markdown>{part.text}</Markdown>
                                </div>
                            </div>
                        );
                    }
                })}
            </div>
        </div>
    );
}