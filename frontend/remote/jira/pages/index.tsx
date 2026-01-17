'use client';
import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import {Checkbox, Input} from "@mui/material";
import {useChat} from "@ai-sdk/react";
import { DefaultChatTransport } from 'ai';
import ChatMessage from "../components/ChatLLM/ChatMessage";
import {SimpleTreeView, TreeItem} from "@mui/x-tree-view";
import Markdown from "react-markdown";

const jiraProxy = "http://localhost:80/jiraproxy/webDomain";

export default function Index(this: any) {

    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [ticketTypes, setTicketTypes] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [userToken, setUserToken] = useState("");
    //Make sure only runs once
    const effectRan = useRef(false);
    if (!effectRan.current) {
        if (typeof window !== "undefined") {
            setUserToken(localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '')
            effectRan.current = true;
        }
    }
    const [input, setInput] = useState('');
    const [compareModal, setCompareModal] = useState({open: false, original: null, proposed: null});
    const [newTicketModal, setNewTicketModal] = useState({open: false});
    const [editModal, setEditModal] = useState<{ open: boolean; ticket?: any }>({open: false});
    const [batchModal, setBatchModal] = useState<{
        open: boolean;
        parent?: any;
        childType?: "Task" | "Subtask";
        count: number;
        loading: boolean;
        error?: string;
        suggestions: { summary: string; description: string; create: boolean }[];
    }>({open: false, count: 5, loading: false, suggestions: []});

    const [awaitingBatch, setAwaitingBatch] = useState(false);

    const [newTicketData, setNewTicketData] = useState({summary: "", description: "", issuetype: "", parentKey: ""});
    const [editableProposed, setEditableProposed] = useState<{ summary: string; description: string } | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; ticketKey?: string }>({open: false});

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Chat state
    const {
        messages,
        setMessages,
        sendMessage,
        stop,
        status
    } = useChat({
        transport: new DefaultChatTransport({
            api: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":5003/api/chat"
        }),
    });

    useEffect(() => {
        getTickets();
        getTicketTypes();
    }, []);

    useEffect(() => {
        if (scrollAreaRef.current) {
            // Scroll to the bottom of the messages list
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
    }, [messages])

    useEffect(() => {
        if (!awaitingBatch) return;

        const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
        if (!lastAssistantMsg) return;

        const messageText = getMessageText(lastAssistantMsg);

        try {
            const data = parseLLMJson(messageText);
            let items = [];
            if (Array.isArray(data)) items = data;
            else if (data?.items) items = data.items;
            else if (data?.proposals) items = data.proposals;

            const suggestions = (items || [])
                .map((it) => ({
                    summary: String(it?.summary || ""),
                    description: String(it?.description || ""),
                    create: true
                }))
                .filter((x) => x.summary);

            if (suggestions.length) {
                setBatchModal((prev) => ({...prev, suggestions, loading: false, error: undefined}));
                setAwaitingBatch(false);
            }
        } catch {
            // ignore until JSON is complete
        }
    }, [messages, awaitingBatch]);

    function getTickets() {
        const postData = {
            webDomain: process.env.NEXT_PUBLIC_JIRA_DOMAIN + "/rest/api/latest/search/jql?jql=project=" + process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY + "&maxResults=1000&fields=key,summary,description,issuetype,parent",
            webApiKey: "Basic " + Buffer.from(`${process.env.NEXT_PUBLIC_JIRA_EMAIL}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN || process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL}`).toString("base64"),
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        setLoading(true);
        axios.post(jiraProxy + "/get", postData, axiosConfig)
            .then((response) => setTickets(response.data.issues))
            .finally(() => setLoading(false));
    }

    function getTicketTypes() {
        const postData = {
            webDomain: process.env.NEXT_PUBLIC_JIRA_DOMAIN + "/rest/api/latest/issuetype/project?projectId=10000",
            webApiKey: "Basic " + Buffer.from(`${process.env.NEXT_PUBLIC_JIRA_EMAIL}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN || process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL}`).toString("base64"),
        };

        let axiosConfig = {headers: {"Content-Type": "application/json", Authorization: userToken}};
        setLoading(true);
        axios.post(jiraProxy + "/get", postData, axiosConfig)
            .then((response) => setTicketTypes(response.data))
            .finally(() => setLoading(false));
    }

    function updateTicket(ticket: any, reference: any) {
        console.log("reference: ", reference);
        console.log("ticket: ", ticket);
        let postData = {
            update: {
                summary: [
                    {
                        set: (ticket.summary || reference.fields.summary)
                    }
                ],
                description: [
                    {
                        set: (ticket.description || reference.fields.description)
                    }
                ]
            },
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + reference.id,
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
        };


        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        //console.log("postData: ", postData);
        axios.put(jiraProxy + "/put", postData, axiosConfig)
            .then((response) => {
                getTickets()

            })
            .catch((error) => {
                console.log(error.status)
            })
    }

    function deleteTicket(ticketKey: string) {
        const postData = {
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + ticketKey,
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post(jiraProxy + "/delete", postData, axiosConfig)
            .then((response) => {
                //console.log("RESPONSE RECEIVED: ", response.data.issues);
                getTickets()

            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", postData);
            })
    }

    function newTicket(input: any) {
        const postData = {
            fields: {
                project:
                    {
                        key: process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY
                    },
                summary: input.summary,
                description: input.description,
                issuetype: {name: input.issuetype || "Task"},
                ...(input.parentKey && {parent: {key: input.parentKey}}),
            },
            webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue",
            webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
        };

        let axiosConfig = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userToken
            }
        };

        console.log("postData: ", postData);
        axios.post(jiraProxy + "/post", postData, axiosConfig)
            .then((response) => {
                getTickets()
                //console.log("RESPONSE RECEIVED: ", response);
            })
            .catch((error) => {
                //console.log("AXIOS ERROR: ", error.response);
            })
    }

    function openEdit(ticket: any) {
        setEditModal({open: true, ticket});
        console.log("ticket", ticket)
    }

    function openCompare(original: any, proposed: any) {
        setEditableProposed({...proposed});
        setCompareModal({open: true, original, proposed});
    }

    function childTypeForParent(parentKey?: string): "Task" | "Subtask" | undefined {
        if (!parentKey) return undefined;
        const parent = tickets.find((t) => t.key === parentKey);
        const tname = parent?.fields?.issuetype?.name;
        if (tname === "Epic") return "Task";
        if (tname === "Task") return "Subtask";
        return undefined; // fallback handled later
    }

    function getMessageText(message) {
        if (!message) return '';

        if (Array.isArray(message.parts)) {
            return message.parts
                .filter(part => part.type === "text")
                .map(part => {
                    console.log("part.text", part.text);
                    return part.text || "";
                })
                .join(" ")
                .trim();
        }

        return '';
    }

    // Batch create suggestions (mock with AI integration placeholder)
    function openBatchCreate(parent: any) {
        setBatchModal({
            open: true,
            parent,
            childType: childTypeForParent(parent.key),
            count: 5,
            loading: false,
            suggestions: [],
        });
    }

    function requestBatchFromAI(count: number, parent?: any) {
        const prompt =
            `Give ${count} ticket proposal for ${parent?.fields.summary} with ${parent?.fields.description}, answer in Json array format [{summary: string for the short name of the ticket, description: string for the detailed description}]. ` +
            `Your answer should only contain json response, no other text.`;

        setMessages([])
        setNewTicketData({...newTicketData, parentKey: parent?.fields.key})
        setBatchModal(prev => ({...prev, open: false}))
        // clear out old suggestions right away
        setBatchModal({
            parent: parent,
            open: true,
            count: count,
            suggestions: [],
            loading: true,
            error: undefined,
        });

        setAwaitingBatch(true);
        sendMessage({ text: prompt });
    }

    function parseLLMJson(text: string): any {
        if (!text) return null;
        let s = String(text).trim();
        s = s.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
        const first = Math.min(...['{', '['].map(ch => s.indexOf(ch)).filter(i => i >= 0));
        const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
        if (first >= 0 && last > first) s = s.slice(first, last + 1);
        try {
            return JSON.parse(s);
        } catch {
            return null;
        }
    }

    // Add state at the top of your component
    const [chatOpen, setChatOpen] = useState(false);

    // Modify handleChatWithTicket to open the chat panel
    function handleChatWithTicket(ticket: any, includeChildren: boolean) {
        setMessages([]);
        const scope = includeChildren ? collectChildren(ticket) : [ticket];
        const scopeText = scope.map((t) => `${t.key}: ${t.fields.summary}\n${t.fields.description}`).join("\n\n");
        sendMessage({ text: `Please review and improve the following tickets:\n\n${scopeText}` });
        setSelectedTicket(ticket);
        setChatOpen(true); // 👈 open right chat
    }

    // Build Epic → (Task | Story | Request| Bug) tree where Tasks can have Subtasks as children + parentless
    function buildHierarchy() {
        const epics = tickets.filter((t) => t.fields.issuetype.name === "Epic");
        const tasks = tickets.filter((t) => t.fields.issuetype.name === "Task");
        const others = tickets.filter((t) => ["Story", "Request", "Bug"].includes(t.fields.issuetype.name));
        const subtasks = tickets.filter((t) => t.fields.issuetype.name === "Subtask");

        const epicNodes = epics.map((epic) => ({
            ...epic,
            children: [
                ...tasks.filter((f) => f.fields.parent?.key === epic.key),
                ...others.filter((o) => o.fields.parent?.key === epic.key),
            ],
        }));

        tasks.forEach((f) => {
            f.children = subtasks.filter((s) => s.fields.parent?.key === f.key);
        });

        const parentless = tickets.filter((t) => !t.fields.parent?.key && t.fields.issuetype.name !== "Epic");

        parentless.forEach((f) => {
            f.children = subtasks.filter((s) => s.fields.parent?.key === f.key);
        });

        return {epicNodes, parentless};
    }

    const {epicNodes, parentless} = buildHierarchy();

    function collectChildren(ticket: any): any[] {
        let collected = [ticket];
        const children = tickets.filter((t) => t.fields.parent?.key === ticket.key);
        children.forEach((c) => {
            collected = collected.concat(collectChildren(c));
        });
        return collected;
    }


    const [selectedOption, setSelectedOption] = useState("")


    const handleSubmit = e => {
        e.preventDefault();
        sendMessage({ text: input });
        setInput('');
    };

    useEffect(() => {
        if (scrollAreaRef.current) {
            // Scroll to the bottom of the messages list
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        }
    }, [messages])

    if (loading) return <p>Loading...</p>

    return (
        <div className="flex flex-row items-center justify-center h-[90%] w-[70%] m-auto py-10 gap-10">
            {/* Jira ticket list */}
            <div className="Chat relative flex flex-col h-full">
                <div className="flex items-center gap-2">
                    <Button size="small" onClick={getTickets}>Refresh</Button>
                    <Button size="small" onClick={() => setNewTicketModal({open: true})}>Add New</Button>
                    {/* Floating Toggle Chat Button inside Jira list */}
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => setChatOpen((prev) => !prev)}
                    >
                        {chatOpen ? "× Turn off AI" : "💬Turn on AI"}
                    </Button>
                </div>
                {loading ? <p>Loading...</p> : (
                    <SimpleTreeView>
                        {epicNodes.map((epic) => (
                            <TreeItem key={epic.key} itemId={epic.key} label={`${epic.key}: ${epic.fields.summary}`}>
                                <div className="ml-2 mt-1 flex flex-wrap gap-2">
                                    <Button size="small" onClick={() => openEdit(epic)}>Edit</Button>
                                    <Button size="small" color="error" onClick={() => setDeleteModal({
                                        open: true,
                                        ticketKey: epic.key
                                    })}>Delete</Button>
                                    {chatOpen && (
                                        <>
                                            <Button className="animate-pulse text-purple-500" size="small"
                                                    onClick={() => handleChatWithTicket(epic, true)}>Chat with
                                                Ticket+Children</Button>
                                            <Button className="animate-pulse text-purple-500" size="small"
                                                    onClick={() => handleChatWithTicket(epic, false)}>Chat with
                                                Ticket</Button>
                                            <Button size="small" onClick={() => openBatchCreate(epic)}>Batch
                                                Create</Button>
                                        </>
                                    )}
                                </div>
                                {epic.children.map((child: any) => (
                                    <TreeItem key={child.key} itemId={child.key}
                                              label={`📄 ${child.key}: ${child.fields.summary}`}>
                                        <div className="ml-4 mt-1 flex flex-wrap gap-2">
                                            {chatOpen && (
                                                <>
                                                    <Button className="animate-pulse text-purple-500" size="small"
                                                            onClick={() => handleChatWithTicket(child, false)}>Chat with
                                                        Ticket</Button>
                                                    <Button size="small" onClick={() => openBatchCreate(child)}>Batch
                                                        Create</Button>
                                                </>
                                            )}
                                            <Button size="small" onClick={() => openEdit(child)}>Edit</Button>
                                            <Button size="small" color="error" onClick={() => setDeleteModal({
                                                open: true,
                                                ticketKey: child.key
                                            })}>Delete</Button>
                                        </div>
                                        {child.children && child.children.map((sub: any) => (
                                            <TreeItem key={sub.key} itemId={sub.key}
                                                      label={`🔹 ${sub.key}: ${sub.fields.summary}`}/>
                                        ))}
                                        {child.fields.issuetype.name === "Task" && (
                                            <Button size="small" onClick={() => openBatchCreate(child.key)}>
                                                Batch Create
                                            </Button>
                                        )}
                                    </TreeItem>
                                ))}
                            </TreeItem>
                        ))}
                        {parentless.length > 0 && (
                            <TreeItem itemId="parentless" label="🗂️ Tickets without Parent">
                                {parentless.map((t) => (
                                    <>
                                        <TreeItem key={t.key} itemId={t.key} label={`📄 ${t.key}: ${t.fields.summary}`}>
                                            <div className="ml-4 mt-1 flex flex-wrap gap-2">
                                                {chatOpen && (
                                                    <>
                                                        <Button className="animate-pulse text-purple-500" size="small"
                                                                onClick={() => handleChatWithTicket(t, true)}>Chat with
                                                            Ticket+Children</Button>
                                                        <Button className="animate-pulse text-purple-500" size="small"
                                                                onClick={() => handleChatWithTicket(t, false)}>Chat with
                                                            Ticket</Button>
                                                    </>
                                                )}
                                                <Button size="small" onClick={() => openEdit(t)}>Edit</Button>
                                                <Button size="small" color="error" onClick={() => setDeleteModal({
                                                    open: true,
                                                    ticketKey: t.key
                                                })}>Delete</Button>
                                            </div>
                                            {t.fields.issuetype.name === "Task" && (
                                                <Button size="small" onClick={() => openBatchCreate(t.key)}>
                                                    Batch Create
                                                </Button>
                                            )}
                                            {t.children.map((child: any) => (
                                                <TreeItem key={child.key} itemId={child.key}
                                                          label={`📄 ${child.key}: ${child.fields.summary}`}>
                                                    <div className="ml-4 mt-1 flex flex-wrap gap-2">
                                                        {chatOpen && (
                                                            <>
                                                                <Button className="animate-pulse text-purple-500"
                                                                        size="small"
                                                                        onClick={() => handleChatWithTicket(child, false)}>Chat
                                                                    with Ticket</Button>
                                                            </>
                                                        )}

                                                        <Button size="small"
                                                                onClick={() => openEdit(child)}>Edit</Button>
                                                        <Button size="small" color="error"
                                                                onClick={() => setDeleteModal({
                                                                    open: true,
                                                                    ticketKey: child.key
                                                                })}>Delete</Button>
                                                    </div>
                                                    {child.children && child.children.map((sub: any) => (
                                                        <TreeItem key={sub.key} itemId={sub.key}
                                                                  label={`🔹 ${sub.key}: ${sub.fields.summary}`}/>
                                                    ))}
                                                </TreeItem>
                                            ))}
                                        </TreeItem>
                                    </>
                                ))}
                            </TreeItem>
                        )}
                    </SimpleTreeView>
                )}
            </div>
            {chatOpen && (
                <>
                    {/* Chat area */}
                    <div className="Chat">
                        <div ref={scrollAreaRef} className="messages-list">
                            {messages.length <= 0 ? (
                                <div className="flex flex-col items-center h-full text-left p-4">
                                    <div className="w-16 h-16 mb-4 text-primary" />
                                    <h1 className="text-2xl font-bold mb-2">Welcome to Local AI Jira Chatbot - For full privacy</h1>
                                    <p className="text-muted-foreground mb-4">
                                        You can start to discuss below.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message, index) => (
                                        <>
                                            <ChatMessage
                                                key={message.id || index}
                                                message={message}
                                                isLast={index === messages.length - 1}
                                            />
                                            {message.role === "assistant" && selectedTicket && (
                                                <div className="flex gap-2 mt-2">
                                                    {(status === 'ready') && (
                                                        <Button className="animate-pulse text-purple-500" variant="contained"
                                                                size="small"
                                                                onClick={() => {
                                                                    openCompare(
                                                                        {
                                                                            summary: selectedTicket.fields.summary,
                                                                            description: selectedTicket.fields.description
                                                                        },
                                                                        {
                                                                            summary: "Improved " + selectedTicket.fields.summary,
                                                                            description: getMessageText(message)
                                                                        }
                                                                    );
                                                                }}>
                                                            Approve
                                                        </Button>
                                                    )}
                                                    {(status != 'ready') && (
                                                        <Button className="animate-pulse text-purple-500" variant="contained">
                                                            Please wait
                                                        </Button>
                                                    )}
                                                    {(status === 'submitted' || status === 'streaming') && (
                                                        <Button variant="outlined" size="small"
                                                                onClick={() => (stop(), setMessages([]))}>
                                                            Stop
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </>
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
                </>
            )}
            {/* Comparison Modal */}
            <Dialog open={compareModal.open}
                    onClose={() => setCompareModal({original: null, proposed: null, open: false})} maxWidth="md"
                    fullWidth>
                <DialogTitle>Compare Ticket Changes</DialogTitle>
                <DialogContent dividers>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-bold">Original</h3>
                            <p><strong>Summary:</strong> <Markdown>{compareModal.original?.summary}</Markdown></p>
                            <p><strong>Description:</strong><br/>
                                <Markdown>{compareModal.original?.description}</Markdown></p>
                        </div>
                        <div>
                            <h3 className="font-bold">Proposed (Editable)</h3>
                            <TextField
                                fullWidth
                                label="Summary"
                                variant="outlined"
                                margin="dense"
                                value={editableProposed?.summary || ""}
                                onChange={(e) => setEditableProposed((prev) => ({...prev!, summary: e.target.value}))}
                            />
                            <TextField
                                fullWidth
                                label="Description"
                                variant="outlined"
                                margin="dense"
                                multiline
                                minRows={6}
                                value={editableProposed?.description || ""}
                                onChange={(e) => setEditableProposed((prev) => ({
                                    ...prev!,
                                    description: e.target.value
                                }))}
                            />
                        </div>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setCompareModal({original: null, proposed: null, open: false})}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (compareModal.original && editableProposed && selectedTicket) {
                                updateTicket(editableProposed, selectedTicket);
                            }
                            setCompareModal({original: null, proposed: null, open: false});
                        }}
                    >
                        Approve & Update
                    </Button>
                </DialogActions>
            </Dialog>

            {/* New Ticket Modal */}
            <Dialog open={newTicketModal.open} onClose={() => setNewTicketModal({open: false})} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogContent dividers>
                    <div className="flex flex-col gap-4">
                        <TextField
                            fullWidth
                            label="Project"
                            variant="outlined"
                            value={process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY}
                            disabled
                        />
                        <TextField
                            fullWidth
                            label="Summary"
                            variant="outlined"
                            value={newTicketData.summary}
                            onChange={(e) => setNewTicketData({...newTicketData, summary: e.target.value})}
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            variant="outlined"
                            multiline
                            minRows={4}
                            value={newTicketData.description}
                            onChange={(e) => setNewTicketData({...newTicketData, description: e.target.value})}
                        />
                        Tycket type
                        <TextField
                            select
                            fullWidth
                            value={newTicketData.issuetype}
                            onChange={(e) => setNewTicketData({...newTicketData, issuetype: e.target.value})}
                            SelectProps={{native: true}}
                        >
                            <option value="">-- Select Type --</option>
                            {ticketTypes.map((type: any) => (
                                <option key={type.id} value={type.name}>
                                    {type.name}
                                </option>
                            ))}
                        </TextField>
                        {/* Show Parent Epic dropdown only if issue type is not Epic */}
                        {newTicketData.issuetype && newTicketData.issuetype !== "Epic" && (
                            <>
                                Parent
                                <TextField
                                    select
                                    fullWidth
                                    value={newTicketData.parentKey || ""}
                                    onChange={(e) => setNewTicketData({...newTicketData, parentKey: e.target.value})}
                                    SelectProps={{native: true}}
                                >
                                    {newTicketData.issuetype && newTicketData.issuetype !== "Subtask" && (
                                        <>
                                            <option value="">-- Select Epic --</option>
                                            {tickets
                                                .filter((t) => t.fields.issuetype.name === "Epic")
                                                .map((epic) => (
                                                    <option key={epic.key} value={epic.key}>
                                                        {epic.key}: {epic.fields.summary}
                                                    </option>
                                                ))}
                                        </>
                                    )}

                                    {newTicketData.issuetype && newTicketData.issuetype == "Subtask" && (
                                        <>
                                            <option value="">-- Select Task --</option>
                                            {tickets
                                                .filter((t) => t.fields.issuetype.name === "Task")
                                                .map((task) => (
                                                    <option key={task.key} value={task.key}>
                                                        {task.key}: {task.fields.summary}
                                                    </option>
                                                ))}
                                        </>
                                    )}
                                </TextField>
                            </>
                        )}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setNewTicketModal({open: false});
                            setNewTicketData({summary: "", description: "", issuetype: "", parentKey: ""}); // reset on cancel
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (newTicketData.summary && newTicketData.issuetype) {
                                newTicket(newTicketData);
                                setNewTicketModal({open: false});
                                setNewTicketData({summary: "", description: "", issuetype: "", parentKey: ""}); // reset form
                            }
                        }}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={editModal.open} onClose={() => setEditModal({open: false})} fullWidth>
                <DialogTitle>Edit Ticket</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        fullWidth
                        label="Summary"
                        value={editModal.ticket?.fields.summary || ""}
                        onChange={(e) =>
                            setEditModal((prev) => ({
                                ...prev,
                                ticket: {
                                    ...prev.ticket,
                                    fields: {
                                        ...prev.ticket.fields,
                                        summary: e.target.value,
                                    },
                                },
                            }))
                        }
                        error={!editModal.ticket?.fields.summary}
                        helperText={!editModal.ticket?.fields.summary ? "Summary required" : ""}
                    />

                    <TextField
                        fullWidth
                        label="Description"
                        multiline
                        minRows={4}
                        value={editModal.ticket?.fields.description || ""}
                        onChange={(e) =>
                            setEditModal((prev) => ({
                                ...prev,
                                ticket: {
                                    ...prev.ticket,
                                    fields: {
                                        ...prev.ticket.fields,
                                        description: e.target.value,
                                    },
                                },
                            }))
                        }
                        error={!editModal.ticket?.fields.description}
                        helperText={!editModal.ticket?.fields.description ? "Description required" : ""}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditModal({open: false})}>Cancel</Button>
                    <Button variant="contained" onClick={() =>
                        editModal.ticket && (updateTicket(editModal.ticket, editModal.ticket), setEditModal({open: false}))
                    }>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Batch Create Modal */}
            <Dialog open={batchModal.open} onClose={() => setBatchModal((p) => ({...p, open: false}))} fullWidth>
                <DialogTitle>Batch Create Tickets</DialogTitle>
                <DialogContent dividers>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div>
                                <span className="text-sm text-gray-600">Parent:</span>
                                <span className="ml-2 font-medium">{batchModal.parent?.key}</span>
                                {batchModal.childType && (
                                    <span className="ml-2 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                                        Will create {batchModal.childType}s
                                    </span>
                                )}
                            </div>
                            <TextField
                                type="number"
                                label="# proposals"
                                size="small"
                                inputProps={{min: 1, max: 20}}
                                value={batchModal.count}
                                onChange={(e) =>
                                    setBatchModal((p) => ({
                                        ...p,
                                        count: Math.max(1, Math.min(20, Number(e.target.value) || 1))
                                    }))
                                }
                                className="w-32"
                            />
                            <Button variant="contained"
                                    onClick={() => requestBatchFromAI(batchModal.count, batchModal.parent)}
                                    disabled={batchModal.loading}>
                                {batchModal.loading ? "Asking AI…" : "Ask AI for proposals"}
                            </Button>
                        </div>

                        {batchModal.error && <div className="text-red-600 text-sm">{batchModal.error}</div>}

                        {batchModal.suggestions.map((sug, idx) => (
                            <div key={idx} className="flex items-start space-x-2 mb-2">
                                <Checkbox
                                    checked={sug.create}
                                    onChange={(e) =>
                                        setBatchModal((prev) => ({
                                            ...prev,
                                            suggestions: prev.suggestions.map((x, i) =>
                                                i === idx ? {...x, create: e.target.checked} : x
                                            ),
                                        }))
                                    }
                                />
                                <div className="flex-1">
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Summary"
                                        margin="dense"
                                        value={sug.summary}
                                        onChange={(e) =>
                                            setBatchModal((prev) => ({
                                                ...prev,
                                                suggestions: prev.suggestions.map((x, i) =>
                                                    i === idx ? {...x, summary: e.target.value} : x
                                                ),
                                            }))
                                        }
                                    />
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Description"
                                        margin="dense"
                                        multiline
                                        minRows={3}
                                        value={sug.description}
                                        onChange={(e) =>
                                            setBatchModal((prev) => ({
                                                ...prev,
                                                suggestions: prev.suggestions.map((x, i) =>
                                                    i === idx ? {...x, description: e.target.value} : x
                                                ),
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBatchModal((p) => ({...p, open: false}))}>Close</Button>
                    <Button
                        variant="contained"
                        disabled={batchModal.suggestions.filter((s) => s.create).length === 0}
                        onClick={() => {
                            const childType = batchModal.childType || "Task";
                            batchModal.suggestions
                                .filter((s) => s.create && s.summary)
                                .forEach((s) =>
                                    newTicket({
                                        summary: s.summary,
                                        description: s.description,
                                        issuetype: childType,
                                        parentKey: batchModal.parent?.key,
                                    })
                                );
                            setBatchModal((p) => ({...p, open: false}));
                        }}>
                        Create selected
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Modal */}
            <Dialog
                open={deleteModal.open}
                onClose={() => setDeleteModal({open: false})}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent dividers>
                    <p>Are you sure you want to delete ticket <strong>{deleteModal.ticketKey}</strong>?</p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteModal({open: false})}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                            if (deleteModal.ticketKey) {
                                deleteTicket(deleteModal.ticketKey);
                            }
                            setDeleteModal({open: false});
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    )
}