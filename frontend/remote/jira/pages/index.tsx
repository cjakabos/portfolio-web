'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, MessageSquare, ChevronRight, ChevronDown, RefreshCw,
  Check, X, Edit, Zap, MessageCircle, Send, Bot, Sparkles, User, GripVertical,
  AlertCircle, AlertTriangle, Loader2
} from 'lucide-react';
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from 'ai';

// =============================================================================
// URL CONFIGURATION
// =============================================================================
const jiraProxy = "http://localhost:80/jiraproxy/webDomain";
const ollamaBaseUrl = "http://localhost:11434";
const chatApiUrl = "http://localhost:5333/api/chat";

// Type for Ollama model
interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

// --- Sub-Components ---

// 1. Modal Component
const Modal = ({ open, onClose, title, children, actions, maxWidth = 'max-w-lg' }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        {actions && (
          <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex justify-end gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

// 2. Alert Component
const Alert = ({ severity, title, children, action }: { severity: 'error' | 'warning' | 'info', title: string, children: React.ReactNode, action?: React.ReactNode }) => {
  const colors = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
  };
  const icons = {
    error: <AlertCircle size={20} className="text-red-600 dark:text-red-400" />,
    warning: <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />,
    info: <AlertCircle size={20} className="text-blue-600 dark:text-blue-400" />
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[severity]}`}>
      <div className="flex items-start gap-3">
        {icons[severity]}
        <div className="flex-1">
          <h4 className="font-bold mb-1">{title}</h4>
          <div className="text-sm">{children}</div>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
};

// 3. Tree Item Component
const TicketNode = ({ ticket, level = 0, onChat, onChatWithChildren, onEdit, onDelete, onBatch, chatOpen }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = ticket.children && ticket.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md group transition-colors ${level === 0 ? 'border-l-4 border-blue-500 pl-2 bg-white dark:bg-gray-800 mb-1 shadow-sm' : ''}`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <div
          className={`p-1 mr-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 ${hasChildren ? 'visible' : 'invisible'}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${
              ticket.fields.issuetype.name === 'Epic' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
              ticket.fields.issuetype.name === 'Task' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
              ticket.fields.issuetype.name === 'Story' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
              ticket.fields.issuetype.name === 'Bug' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
              'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
            }`}>
              {ticket.fields.issuetype.name}
            </span>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{ticket.key}</span>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 truncate">{ticket.fields.summary}</div>
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2">
          {chatOpen && (
            <>
              <button onClick={() => onChat(ticket, false)} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded" title="Chat with Ticket">
                <MessageCircle size={14} />
              </button>
              {hasChildren && (
                <button onClick={() => onChatWithChildren(ticket, true)} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded" title="Chat with Ticket + Children">
                  <MessageSquare size={14} />
                </button>
              )}
            </>
          )}
          {(ticket.fields.issuetype.name === 'Task' || ticket.fields.issuetype.name === 'Epic') && chatOpen && (
            <button onClick={() => onBatch(ticket)} className="p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 rounded" title="Batch Create">
              <Zap size={14} />
            </button>
          )}
          <button onClick={() => onEdit(ticket)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded" title="Edit">
            <Edit size={14} />
          </button>
          <button onClick={() => onDelete(ticket.key)} className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isOpen && hasChildren && (
        <div>
          {ticket.children.map((child: any) => (
            <TicketNode
              key={child.key}
              ticket={child}
              level={level + 1}
              onChat={onChat}
              onChatWithChildren={onChatWithChildren}
              onEdit={onEdit}
              onDelete={onDelete}
              onBatch={onBatch}
              chatOpen={chatOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const CloudJira: React.FC = () => {
  // Core state
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [userToken, setUserToken] = useState("");

  // Jira configuration state
  const [jiraConfigError, setJiraConfigError] = useState<string[] | null>(null);
  const [jiraApiError, setJiraApiError] = useState<string | null>(null);

  // Model selection state
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState('');
  const [awaitingBatch, setAwaitingBatch] = useState(false);

  // Modal states
  const [newTicketModal, setNewTicketModal] = useState({ open: false });
  const [editModal, setEditModal] = useState<{ open: boolean; ticket?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; ticketKey?: string }>({ open: false });
  const [batchModal, setBatchModal] = useState<{
    open: boolean;
    parent?: any;
    childType?: "Task" | "Subtask";
    count: number;
    loading: boolean;
    error?: string;
    suggestions: { summary: string; description: string; create: boolean }[];
  }>({ open: false, count: 5, loading: false, suggestions: [] });
  const [compareModal, setCompareModal] = useState<{ open: boolean; original: any; proposed: any }>({ open: false, original: null, proposed: null });

  // Form data
  const [newTicketData, setNewTicketData] = useState({ summary: "", description: "", issuetype: "", parentKey: "" });
  const [editableProposed, setEditableProposed] = useState<{ summary: string; description: string } | null>(null);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const effectRan = useRef(false);

  // Resizing state
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Chat hook
  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status
  } = useChat({
    transport: new DefaultChatTransport({
      api: "http://" + (process.env.DOCKER_HOST_IP || "localhost") + ":5333/api/chat"
    }) as any,
  });

  // Initialize user token
  if (!effectRan.current) {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") || '';
      if (token) setUserToken(token);
      effectRan.current = true;
    }
  }

  // --- Resizing Logic ---
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // --- Helper Functions ---

  function formatModelSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }

  function validateJiraConfig(): string[] {
    const missingVars: string[] = [];
    if (!process.env.NEXT_PUBLIC_JIRA_DOMAIN) missingVars.push("NEXT_PUBLIC_JIRA_DOMAIN");
    if (!process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY) missingVars.push("NEXT_PUBLIC_JIRA_PROJECT_KEY");
    if (!process.env.NEXT_PUBLIC_JIRA_EMAIL) missingVars.push("NEXT_PUBLIC_JIRA_EMAIL");
    if (!process.env.NEXT_PUBLIC_JIRA_API_TOKEN && !process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL) {
      missingVars.push("NEXT_PUBLIC_JIRA_API_TOKEN");
    }
    return missingVars;
  }

  function getMessageText(message: any): string {
    if (!message) return '';
    if (Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text || "")
        .join(" ")
        .trim();
    }
    return '';
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

  function childTypeForParent(parentKey?: string): "Task" | "Subtask" | undefined {
    if (!parentKey) return undefined;
    const parent = tickets.find((t) => t.key === parentKey);
    const tname = parent?.fields?.issuetype?.name;
    if (tname === "Epic") return "Task";
    if (tname === "Task") return "Subtask";
    return undefined;
  }

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

    return { epicNodes, parentless };
  }

  function collectChildren(ticket: any): any[] {
    let collected = [ticket];
    const children = tickets.filter((t) => t.fields.parent?.key === ticket.key);
    children.forEach((c) => {
      collected = collected.concat(collectChildren(c));
    });
    return collected;
  }

  // --- API Functions ---

  async function fetchOllamaModels() {
    setModelsLoading(true);
    setModelsError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const allModels = data.models || [];

      // Filter out embedding models - they can't be used for chat
      const models = allModels.filter((m: OllamaModel) =>
        !m.name.toLowerCase().includes('embed')
      );

      if (models.length === 0) {
        setModelsError("no_models");
        setAvailableModels([]);
        setSelectedModel("");
        return;
      }

      setAvailableModels(models);
      const defaultModel = models[0].name;
      setSelectedModel(defaultModel);
      setModelsError(null);
    } catch (error: any) {
      // Silently handle the error - don't let it bubble up to Next.js error overlay
      console.warn("Ollama connection check:", error?.message || "Connection failed");

      const isTimeout = error?.name === 'AbortError' || error?.message?.includes('timeout');

      if (isTimeout) {
        setModelsError("timeout");
      } else {
        setModelsError("connection_failed");
      }

      setAvailableModels([]);
      setSelectedModel("");
    } finally {
      setModelsLoading(false);
    }
  }

  function getTickets() {
    const postData = {
      webDomain: process.env.NEXT_PUBLIC_JIRA_DOMAIN + "/rest/api/latest/search/jql?jql=project=" + process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY + "&maxResults=1000&fields=key,summary,description,issuetype,parent",
      webApiKey: "Basic " + Buffer.from(`${process.env.NEXT_PUBLIC_JIRA_EMAIL}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN || process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL}`).toString("base64"),
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': userToken
      }
    };

    setLoading(true);
    setJiraApiError(null);
    axios.post(jiraProxy + "/get", postData, axiosConfig)
      .then((response) => {
        setTickets(response.data.issues || []);
        setJiraApiError(null);
      })
      .catch((error) => {
        console.error("Failed to fetch Jira tickets:", error);
        if (error.response?.status === 401) {
          setJiraApiError("authentication_failed");
        } else if (error.response?.status === 403) {
          setJiraApiError("permission_denied");
        } else if (error.response?.status === 404) {
          setJiraApiError("project_not_found");
        } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          setJiraApiError("network_error");
        } else {
          setJiraApiError("unknown");
        }
      })
      .finally(() => setLoading(false));
  }

  function getTicketTypes() {
    const postData = {
      webDomain: process.env.NEXT_PUBLIC_JIRA_DOMAIN + "/rest/api/latest/issuetype/project?projectId=10000",
      webApiKey: "Basic " + Buffer.from(`${process.env.NEXT_PUBLIC_JIRA_EMAIL}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN || process.env.NEXT_PUBLIC_JIRA_API_TOKEN_LOCAL}`).toString("base64"),
    };

    const axiosConfig = { headers: { "Content-Type": "application/json", Authorization: userToken } };
    setLoading(true);
    axios.post(jiraProxy + "/get", postData, axiosConfig)
      .then((response) => setTicketTypes(response.data))
      .finally(() => setLoading(false));
  }

  function updateTicket(ticket: any, reference: any) {
    const postData = {
      update: {
        summary: [{ set: (ticket.summary || reference.fields.summary) }],
        description: [{ set: (ticket.description || reference.fields.description) }]
      },
      webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + reference.id,
      webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': userToken
      }
    };

    axios.put(jiraProxy + "/put", postData, axiosConfig)
      .then(() => getTickets())
      .catch((error) => console.log(error.status));
  }

  function deleteTicket(ticketKey: string) {
    const postData = {
      webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue/" + ticketKey,
      webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': userToken
      }
    };

    axios.post(jiraProxy + "/delete", postData, axiosConfig)
      .then(() => getTickets())
      .catch((error) => console.log(error));
  }

  function newTicket(ticketInput: any) {
    const postData = {
      fields: {
        project: { key: process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY },
        summary: ticketInput.summary,
        description: ticketInput.description,
        issuetype: { name: ticketInput.issuetype || "Task" },
        ...(ticketInput.parentKey && { parent: { key: ticketInput.parentKey } }),
      },
      webDomain: (process.env.NEXT_PUBLIC_JIRA_DOMAIN) + "/rest/api/latest/issue",
      webApiKey: "Basic " + Buffer.from(`${(process.env.NEXT_PUBLIC_JIRA_EMAIL)}:${process.env.NEXT_PUBLIC_JIRA_API_TOKEN}`).toString("base64")
    };

    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': userToken
      }
    };

    axios.post(jiraProxy + "/post", postData, axiosConfig)
      .then(() => getTickets())
      .catch((error) => console.log(error));
  }

  // --- Event Handlers ---

  function openEdit(ticket: any) {
    setEditModal({ open: true, ticket });
  }

  function openCompare(original: any, proposed: any) {
    setEditableProposed({ ...proposed });
    setCompareModal({ open: true, original, proposed });
  }

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

  async function handleChatWithTicket(ticket: any, includeChildren: boolean) {
    // Quick health check before sending - verify Ollama is still running
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) throw new Error('Ollama not responding');
    } catch {
      console.warn("Ollama health check failed, refreshing models...");
      await fetchOllamaModels();
      setChatOpen(true); // Open chat to show the error
      return;
    }

    setMessages([]);
    const scope = includeChildren ? collectChildren(ticket) : [ticket];
    const scopeText = scope.map((t) => `${t.key}: ${t.fields.summary}\n${t.fields.description}`).join("\n\n");
    sendMessage(
      { role: 'user', parts: [{ type: 'text', text: `Please review and improve the following tickets:\n\n${scopeText}` }] },
      { body: { model: selectedModel } },
    );
    setSelectedTicket(ticket);
    setChatOpen(true);
  }

  async function requestBatchFromAI(count: number, parent?: any) {
    // Quick health check before sending - verify Ollama is still running
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) throw new Error('Ollama not responding');
    } catch {
      console.warn("Ollama health check failed, refreshing models...");
      await fetchOllamaModels();
      return;
    }

    const prompt =
      `Give ${count} ticket proposal for ${parent?.fields.summary} with ${parent?.fields.description}, answer in Json array format [{summary: string for the short name of the ticket, description: string for the detailed description}]. ` +
      `Your answer should only contain json response, no other text.`;

    setMessages([]);
    setNewTicketData({ ...newTicketData, parentKey: parent?.fields.key });
    setBatchModal({
      parent: parent,
      open: true,
      count: count,
      childType: childTypeForParent(parent?.key),
      suggestions: [],
      loading: true,
      error: undefined,
    });

    setAwaitingBatch(true);
    sendMessage(
      { role: 'user', parts: [{ type: 'text', text: prompt }] },
      { body: { model: selectedModel } },
    );
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel || modelsError) return;

    // Quick health check before sending - verify Ollama is still running
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) throw new Error('Ollama not responding');
    } catch {
      console.warn("Ollama health check failed, refreshing models...");
      await fetchOllamaModels();
      return; // Don't send message, let user see the error state
    }

    sendMessage(
      { role: 'user', parts: [{ type: 'text', text: input }] },
      { body: { model: selectedModel } },
    );
    setInput('');
  };

  const handleCreate = () => {
    if (newTicketData.summary && newTicketData.issuetype) {
      newTicket(newTicketData);
      setNewTicketModal({ open: false });
      setNewTicketData({ summary: "", description: "", issuetype: "", parentKey: "" });
    }
  };

  const handleUpdate = () => {
    if (editModal.ticket) {
      updateTicket(editModal.ticket, editModal.ticket);
      setEditModal({ open: false });
    }
  };

  const handleDelete = () => {
    if (deleteModal.ticketKey) {
      deleteTicket(deleteModal.ticketKey);
      setDeleteModal({ open: false });
    }
  };

  const handleBatchCreate = () => {
    const childType = batchModal.childType || "Task";
    batchModal.suggestions.filter((s) => s.create && s.summary).forEach((s) =>
      newTicket({ summary: s.summary, description: s.description, issuetype: childType, parentKey: batchModal.parent?.key })
    );
    setBatchModal((p) => ({ ...p, open: false }));
  };

  // --- Effects ---

  useEffect(() => {
    const missingVars = validateJiraConfig();
    if (missingVars.length > 0) {
      setJiraConfigError(missingVars);
      setLoading(false);
      return;
    }

    getTickets();
    getTicketTypes();
    fetchOllamaModels();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

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
        .map((it: any) => ({
          summary: String(it?.summary || ""),
          description: String(it?.description || ""),
          create: true
        }))
        .filter((x: any) => x.summary);

      if (suggestions.length) {
        setBatchModal((prev) => ({ ...prev, suggestions, loading: false, error: undefined }));
        setAwaitingBatch(false);
      }
    } catch {
      // ignore until JSON is complete
    }
  }, [messages, awaitingBatch]);

  // Build hierarchy
  const { epicNodes, parentless } = buildHierarchy();

  // --- Render ---

  // Show Jira configuration error
  if (jiraConfigError && jiraConfigError.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl w-full">
          <Alert severity="error" title="Jira Configuration Missing">
            <p className="mb-3">The following environment variables are required but not configured:</p>
            <ul className="list-disc ml-4 mb-4 space-y-1">
              {jiraConfigError.map((varName) => (
                <li key={varName} className="font-mono text-red-700 dark:text-red-300">{varName}</li>
              ))}
            </ul>
            <p className="font-medium mb-2">To fix this:</p>
            <ol className="list-decimal ml-4 space-y-2">
              <li>Create a <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">.env.local</code> file in your project root</li>
              <li>Add the following variables:
                <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 text-xs overflow-x-auto">
{`NEXT_PUBLIC_JIRA_DOMAIN=https://your-domain.atlassian.net
NEXT_PUBLIC_JIRA_PROJECT_KEY=YOUR_PROJECT_KEY
NEXT_PUBLIC_JIRA_EMAIL=your-email@example.com
NEXT_PUBLIC_JIRA_API_TOKEN=your-api-token-here`}
                </pre>
              </li>
              <li>Restart the development server</li>
            </ol>
            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded">
              <p className="font-medium text-blue-800 dark:text-blue-300">How to get a Jira API Token:</p>
              <ol className="list-decimal ml-4 mt-1 text-blue-700 dark:text-blue-400 text-sm">
                <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="underline">Atlassian API Tokens</a></li>
                <li>Click "Create API token"</li>
                <li>Copy the generated token</li>
              </ol>
            </div>
          </Alert>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} /> Reload After Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[calc(100vh-2rem)] w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-4 overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">

        {/* 1. Jira Board (Left/Top Pane) */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Jira Board
              </h2>
              <button onClick={getTickets} disabled={!!jiraApiError} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400 transition disabled:opacity-50" title="Refresh">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNewTicketModal({ open: true })}
                disabled={!!jiraApiError}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                <Plus size={16} /> <span className="hidden sm:inline">New Ticket</span>
              </button>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium border transition shadow-sm ${
                  chatOpen
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Bot size={16} /> {chatOpen ? 'Close AI' : 'Local GPT'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-white dark:bg-gray-800">
            {/* Jira API Error States */}
            {jiraApiError === "authentication_failed" && (
              <Alert severity="error" title="Jira Authentication Failed" action={
                <button onClick={getTickets} className="px-3 py-1.5 bg-red-100 dark:bg-red-800 rounded text-sm hover:bg-red-200 dark:hover:bg-red-700">
                  <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
              }>
                <p className="mb-2">Your Jira credentials are invalid or expired.</p>
                <ol className="list-decimal ml-4 text-sm">
                  <li>Verify your <code>NEXT_PUBLIC_JIRA_EMAIL</code> is correct</li>
                  <li>Generate a new API token at Atlassian</li>
                  <li>Update <code>NEXT_PUBLIC_JIRA_API_TOKEN</code></li>
                  <li>Restart the development server</li>
                </ol>
              </Alert>
            )}

            {jiraApiError === "permission_denied" && (
              <Alert severity="error" title="Permission Denied" action={
                <button onClick={getTickets} className="px-3 py-1.5 bg-red-100 dark:bg-red-800 rounded text-sm">
                  <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
              }>
                <p className="mb-2">You don't have access to this Jira project.</p>
                <ul className="list-disc ml-4 text-sm">
                  <li>Verify you have access to project <code>{process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY}</code></li>
                  <li>Check that your Atlassian account has the correct permissions</li>
                </ul>
              </Alert>
            )}

            {jiraApiError === "project_not_found" && (
              <Alert severity="error" title="Project Not Found" action={
                <button onClick={getTickets} className="px-3 py-1.5 bg-red-100 dark:bg-red-800 rounded text-sm">
                  <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
              }>
                <p className="mb-2">The project <code>{process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY}</code> does not exist.</p>
                <ul className="list-disc ml-4 text-sm">
                  <li>Verify the project key is correct (case-sensitive)</li>
                  <li>Update <code>NEXT_PUBLIC_JIRA_PROJECT_KEY</code> in your <code>.env.local</code></li>
                </ul>
              </Alert>
            )}

            {jiraApiError === "network_error" && (
              <Alert severity="warning" title="Network Error" action={
                <button onClick={getTickets} className="px-3 py-1.5 bg-amber-100 dark:bg-amber-800 rounded text-sm">
                  <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
              }>
                <p className="mb-2">Unable to connect to the Jira proxy server.</p>
                <ul className="list-disc ml-4 text-sm">
                  <li>Ensure the Jira proxy server is running at <code>{jiraProxy}</code></li>
                  <li>Check your network connection</li>
                </ul>
              </Alert>
            )}

            {jiraApiError === "unknown" && (
              <Alert severity="error" title="Failed to Load Tickets" action={
                <button onClick={getTickets} className="px-3 py-1.5 bg-red-100 dark:bg-red-800 rounded text-sm">
                  <RefreshCw size={14} className="inline mr-1" /> Retry
                </button>
              }>
                <p>An unexpected error occurred while fetching Jira tickets.</p>
                <p className="mt-1">Please check the browser console for more details.</p>
              </Alert>
            )}

            {loading && tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                Loading tickets...
              </div>
            ) : !jiraApiError && (
              <div className="space-y-2 pb-4">
                {epicNodes.map(epic => (
                  <TicketNode
                    key={epic.key}
                    ticket={epic}
                    onChat={handleChatWithTicket}
                    onChatWithChildren={handleChatWithTicket}
                    onEdit={openEdit}
                    onDelete={(key: string) => setDeleteModal({ open: true, ticketKey: key })}
                    onBatch={openBatchCreate}
                    chatOpen={chatOpen}
                  />
                ))}
                {parentless.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-3">Tickets without Parent</h3>
                    {parentless.map(t => (
                      <TicketNode
                        key={t.key}
                        ticket={t}
                        onChat={handleChatWithTicket}
                        onChatWithChildren={handleChatWithTicket}
                        onEdit={openEdit}
                        onDelete={(key: string) => setDeleteModal({ open: true, ticketKey: key })}
                        onBatch={openBatchCreate}
                        chatOpen={chatOpen}
                      />
                    ))}
                  </div>
                )}
                {epicNodes.length === 0 && parentless.length === 0 && !loading && (
                  <Alert severity="info" title="No Tickets Found">
                    <p>No tickets found in project <code>{process.env.NEXT_PUBLIC_JIRA_PROJECT_KEY}</code>.</p>
                    <p className="mt-1">Click "New Ticket" to create your first ticket.</p>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Drag Handle (Visible only on Desktop when Chat Open) */}
        {chatOpen && (
          <div
            className="hidden md:flex w-4 cursor-col-resize items-center justify-center bg-gray-50 dark:bg-gray-900 border-l border-r border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            onMouseDown={startResizing}
          >
            <GripVertical size={16} className="text-gray-400" />
          </div>
        )}

        {/* 3. Chat Sidebar (Right/Bottom Pane) */}
        {chatOpen && (
          <div
            ref={sidebarRef}
            className="flex flex-col border-t border-gray-200 dark:border-gray-700 md:border-t-0 bg-white dark:bg-gray-800 h-[500px] md:h-auto"
            style={{
              width: typeof window !== 'undefined' && window.innerWidth >= 768 ? sidebarWidth : '100%'
            }}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-3 shrink-0">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full text-green-600 dark:text-green-400">
                <Bot size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 dark:text-white truncate">Local GPT</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Private AI Assistant</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X size={18} />
              </button>
            </div>

            {/* Model Selector */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {/* Error States */}
              {modelsError === "connection_failed" && (
                <div className="space-y-3">
                  <Alert severity="error" title="Cannot connect to Ollama">
                    <p className="mb-3">Unable to reach the Ollama server at <code className="bg-red-100 dark:bg-red-800 px-1 rounded">{ollamaBaseUrl}</code></p>

                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700 mt-3">
                      <h5 className="font-bold text-gray-900 dark:text-white mb-3">🚀 Quick Setup Guide</h5>

                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 1: Install Ollama</p>
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                            <p className="text-gray-600 dark:text-gray-400"># macOS / Linux:</p>
                            <p>curl -fsSL https://ollama.com/install.sh | sh</p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2"># Windows: Download from https://ollama.com/download</p>
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 2: Start Ollama Service</p>
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                            <p>ollama serve</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Keep this terminal open while using the app</p>
                        </div>

                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 3: Pull a Model</p>
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs space-y-1">
                            <p className="text-gray-600 dark:text-gray-400"># Small & fast (recommended for testing):</p>
                            <p>ollama pull qwen3:1.7b</p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2"># Better quality:</p>
                            <p>ollama pull llama3.2</p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2"># Best quality (requires more RAM):</p>
                            <p>ollama pull mistral</p>
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Step 4: Verify Installation</p>
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono text-xs">
                            <p>ollama list</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This should show your installed models</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          📖 Full documentation: <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">ollama.com</a>
                        </p>
                      </div>
                    </div>
                  </Alert>

                  <button
                    onClick={fetchOllamaModels}
                    disabled={modelsLoading}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {modelsLoading ? "Checking connection..." : "Retry Connection"}
                  </button>
                </div>
              )}

              {modelsError === "timeout" && (
                <div className="space-y-3">
                  <Alert severity="warning" title="Connection timeout">
                    <p>Ollama server is not responding. This can happen if:</p>
                    <ul className="list-disc ml-4 mt-2 text-sm">
                      <li>Ollama is still starting up</li>
                      <li>A model is being loaded for the first time</li>
                      <li>The server is processing a heavy request</li>
                    </ul>
                    <p className="mt-2 text-sm">Wait a moment and try again.</p>
                  </Alert>

                  <button
                    onClick={fetchOllamaModels}
                    disabled={modelsLoading}
                    className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {modelsLoading ? "Checking..." : "Retry Connection"}
                  </button>
                </div>
              )}

              {modelsError === "no_models" && (
                <div className="space-y-3">
                  <Alert severity="warning" title="No models installed">
                    <p className="mb-3">Ollama is running but no models are installed yet.</p>

                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-amber-200 dark:border-amber-700 mt-3">
                      <h5 className="font-bold text-gray-900 dark:text-white mb-3">📦 Install a Model</h5>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Open a terminal and run one of these commands:
                      </p>

                      <div className="space-y-3 text-sm">
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">qwen3:1.7b</span>
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">Recommended</span>
                          </div>
                          <code className="text-xs">ollama pull qwen3:1.7b</code>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~1.5 GB • Fast • Good for testing</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">llama3.2</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">Balanced</span>
                          </div>
                          <code className="text-xs">ollama pull llama3.2</code>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~2 GB • Good quality • Meta's latest</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">mistral</span>
                            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded">High Quality</span>
                          </div>
                          <code className="text-xs">ollama pull mistral</code>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">~4 GB • Excellent quality • Requires 8GB+ RAM</p>
                        </div>
                      </div>
                    </div>
                  </Alert>

                  <button
                    onClick={fetchOllamaModels}
                    disabled={modelsLoading}
                    className="w-full py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {modelsLoading ? "Checking..." : "Check for Models"}
                  </button>
                </div>
              )}

              {modelsError === "unknown" && (
                <div className="space-y-3">
                  <Alert severity="error" title="Failed to fetch models">
                    <p>An unexpected error occurred while connecting to Ollama.</p>
                    <p className="mt-2 text-sm">Check the browser console for more details.</p>
                  </Alert>

                  <button
                    onClick={fetchOllamaModels}
                    disabled={modelsLoading}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {modelsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {modelsLoading ? "Checking..." : "Retry"}
                  </button>
                </div>
              )}

              {/* Model Dropdown - only show when no errors */}
              {!modelsError && (
                <>
                  <div className="mb-2 bg-white dark:bg-gray-800">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">AI Model</label>
                    <select
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={modelsLoading || availableModels.length === 0}
                    >
                      {modelsLoading ? (
                        <option value="" disabled>Loading models...</option>
                      ) : (
                        availableModels.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name} ({model.details.parameter_size} • {formatModelSize(model.size)})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800">
                    <button
                      onClick={fetchOllamaModels}
                      disabled={modelsLoading}
                      className="text-sm px-3 py-1.5 rounded flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      {modelsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {modelsLoading ? "Checking..." : "Refresh Models"}
                    </button>
                    {selectedModel && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Using: {selectedModel}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-gray-800 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center opacity-50">
                  <Sparkles size={64} className="mb-4" />
                  <h3 className="text-xl font-bold mb-2">Welcome to Local AI Jira Chatbot</h3>
                  {modelsError ? (
                    <p>⚠️ Please fix the Ollama setup above to start chatting.</p>
                  ) : selectedModel ? (
                    <>
                      <p>You can start to discuss below.</p>
                      <p className="text-sm mt-2">Current model: <strong>{selectedModel}</strong></p>
                    </>
                  ) : modelsLoading ? (
                    <p className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading available models...</p>
                  ) : (
                    <p>Select a model above to start chatting.</p>
                  )}
                </div>
              )}

              {messages.map((message, idx) => (
                <div key={message.id || idx}>
                  {/* Render User Text & Reasoning */}
                  {message.parts?.map((part: any, i: number) => {
                    const isUser = message.role === 'user';
                    const baseClasses = `flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`;
                    const avatarClasses = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-green-600'} text-white`;
                    const bubbleClasses = `max-w-[85%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm break-words`;

                    if (part.type === "text" && isUser) {
                      return (
                        <div key={i} className={baseClasses}>
                          <div className={avatarClasses}><User size={16} /></div>
                          <div className={`${bubbleClasses} bg-green-300 text-black rounded-tr-none`}>{part.text}</div>
                        </div>
                      );
                    }

                    if (part.type === "reasoning") {
                      return (
                        <div key={i} className={baseClasses}>
                          <div className={avatarClasses}><Bot size={16} /></div>
                          <details open className={`${bubbleClasses} bg-blue-300 dark:bg-blue-300 text-gray-900 dark:text-black rounded-tl-none`}>
                            <summary className="font-semibold cursor-pointer mb-2">Reasoning</summary>
                            {part.text}
                          </details>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {/* Render Bot Text & Actions */}
                  {message.parts?.map((part: any, i: number) => {
                    const isUser = message.role === 'user';
                    const baseClasses = `flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`;
                    const avatarClasses = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-600 text-white`;
                    const bubbleClasses = `max-w-[85%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm break-words`;

                    if (part.type === "text" && !isUser && part.text) {
                      return (
                        <div key={i} className={baseClasses}>
                          <div className={avatarClasses}><Bot size={16} /></div>
                          <div className={`${bubbleClasses} bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none`}>
                            {part.text}
                            {/* Jira Specific Action */}
                            {selectedTicket && status === 'ready' && (
                              <div className="mt-4 pt-3 border-t border-gray-400/30 flex gap-2">
                                <button
                                  onClick={() => openCompare(
                                    { summary: selectedTicket.fields.summary, description: selectedTicket.fields.description },
                                    { summary: "Improved " + selectedTicket.fields.summary, description: part.text }
                                  )}
                                  className="text-xs bg-white/80 hover:bg-white dark:bg-gray-600 dark:hover:bg-gray-500 px-3 py-1.5 rounded transition text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5"
                                >
                                  <Check size={12} /> Apply as Changes
                                </button>
                              </div>
                            )}
                            {status !== 'ready' && selectedTicket && (
                              <div className="mt-4 pt-3 border-t border-gray-400/30 flex gap-2">
                                <span className="text-xs text-gray-500 animate-pulse">Please wait...</span>
                                {(status === 'submitted' || status === 'streaming') && (
                                  <button
                                    onClick={() => { stop(); setMessages([]); }}
                                    className="text-xs px-3 py-1.5 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200"
                                  >
                                    Stop
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}

              {(status === 'submitted' || status === 'streaming') && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
                    {[0, 75, 150].map(d => <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={scrollAreaRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
              <form onSubmit={handleChatSubmit} className="relative">
                <input
                  type="text"
                  className="w-full bg-gray-100 dark:bg-gray-700 border-0 rounded-full px-4 md:px-6 py-3 pr-12 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-500 text-sm md:text-base disabled:opacity-50"
                  placeholder={modelsError ? "Fix Ollama setup to enable chat" : "Message GPT..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={!selectedModel || !!modelsError}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || !selectedModel || !!modelsError || status !== 'ready'}
                  className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Create Modal */}
      <Modal
        open={newTicketModal.open}
        onClose={() => setNewTicketModal({ open: false })}
        title="Create New Ticket"
        actions={
          <>
            <button onClick={() => setNewTicketModal({ open: false })} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={!newTicketData.summary} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary *</label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={newTicketData.summary}
              onChange={e => setNewTicketData({ ...newTicketData, summary: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={3}
              value={newTicketData.description}
              onChange={e => setNewTicketData({ ...newTicketData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newTicketData.issuetype}
                onChange={e => setNewTicketData({ ...newTicketData, issuetype: e.target.value })}
              >
                <option value="">Select Type</option>
                {ticketTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            {newTicketData.issuetype && newTicketData.issuetype !== 'Epic' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent</label>
                <select
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={newTicketData.parentKey}
                  onChange={e => setNewTicketData({ ...newTicketData, parentKey: e.target.value })}
                >
                  <option value="">Select Parent</option>
                  {tickets
                    .filter(t => newTicketData.issuetype === 'Subtask' ? t.fields.issuetype.name === 'Task' : t.fields.issuetype.name === 'Epic')
                    .map(t => <option key={t.key} value={t.key}>{t.key}: {t.fields.summary}</option>)
                  }
                </select>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false })}
        title="Edit Ticket"
        actions={
          <>
            <button onClick={() => setEditModal({ open: false })} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
            <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
          </>
        }
      >
        {editModal.ticket && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-2">{editModal.ticket.key}</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary *</label>
              <input
                type="text"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={editModal.ticket.fields.summary || ""}
                onChange={(e) => setEditModal(prev => ({ ...prev, ticket: { ...prev.ticket, fields: { ...prev.ticket.fields, summary: e.target.value } } }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={5}
                value={editModal.ticket.fields.description || ""}
                onChange={(e) => setEditModal(prev => ({ ...prev, ticket: { ...prev.ticket, fields: { ...prev.ticket.fields, description: e.target.value } } }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Batch Modal */}
      <Modal
        open={batchModal.open}
        onClose={() => setBatchModal(p => ({ ...p, open: false }))}
        title="Batch Create Tickets"
        actions={
          <>
            <button onClick={() => setBatchModal(p => ({ ...p, open: false }))} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Close</button>
            <button
              onClick={handleBatchCreate}
              disabled={batchModal.suggestions.filter(s => s.create).length === 0}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              Create Selected
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {batchModal.parent && (
            <div className="text-sm text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              Generating {batchModal.childType || "children"} for:
              <span className="font-bold ml-1">{batchModal.parent.key}</span>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Count</label>
              <input
                type="number" min="1" max="20"
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-20 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={batchModal.count}
                onChange={(e) => setBatchModal((p) => ({ ...p, count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
              />
            </div>
            <button
              onClick={() => requestBatchFromAI(batchModal.count, batchModal.parent)}
              disabled={batchModal.loading || !selectedModel || !!modelsError}
              className="bg-gray-800 dark:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-black dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {batchModal.loading ? 'Thinking...' : 'Ask AI for Suggestions'}
            </button>
          </div>

          {batchModal.error && <div className="text-red-600 text-sm">{batchModal.error}</div>}

          <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
            {batchModal.suggestions.map((sug, idx) => (
              <div key={idx} className="flex gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
                <input
                  type="checkbox"
                  checked={sug.create}
                  onChange={(e) => setBatchModal((prev) => ({
                    ...prev, suggestions: prev.suggestions.map((x, i) => i === idx ? { ...x, create: e.target.checked } : x)
                  }))}
                  className="mt-1.5"
                />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={sug.summary}
                    onChange={(e) => setBatchModal((prev) => ({
                      ...prev, suggestions: prev.suggestions.map((x, i) => i === idx ? { ...x, summary: e.target.value } : x)
                    }))}
                  />
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700"
                    rows={2}
                    value={sug.description}
                    onChange={(e) => setBatchModal((prev) => ({
                      ...prev, suggestions: prev.suggestions.map((x, i) => i === idx ? { ...x, description: e.target.value } : x)
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false })}
        title="Confirm Delete"
        actions={
          <>
            <button onClick={() => setDeleteModal({ open: false })} className="px-4 py-2 text-gray-600 dark:text-gray-300">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
          </>
        }
      >
        <p className="text-gray-900 dark:text-white">Are you sure you want to delete ticket <strong>{deleteModal.ticketKey}</strong>?</p>
      </Modal>

      {/* Compare Modal */}
      <Modal
        open={compareModal.open}
        onClose={() => setCompareModal({ original: null, proposed: null, open: false })}
        title="Compare & Approve Changes"
        maxWidth="max-w-2xl"
        actions={
          <>
            <button onClick={() => setCompareModal({ original: null, proposed: null, open: false })} className="px-4 py-2 text-gray-600 dark:text-gray-300">Cancel</button>
            <button
              onClick={() => {
                if (selectedTicket && editableProposed) {
                  updateTicket(editableProposed, selectedTicket);
                  setCompareModal({ original: null, proposed: null, open: false });
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              Approve & Update
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-100 dark:border-red-900/50">
            <h4 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase mb-2">Original</h4>
            <p className="font-bold text-sm mb-1 text-gray-900 dark:text-white">{compareModal.original?.summary}</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{compareModal.original?.description}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-100 dark:border-green-900/50">
            <h4 className="text-xs font-bold text-green-800 dark:text-green-400 uppercase mb-2">Proposed (Editable)</h4>
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-bold mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={editableProposed?.summary || ''}
              onChange={e => setEditableProposed(p => ({ ...p!, summary: e.target.value }))}
            />
            <textarea
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-700 dark:text-gray-300 h-32 bg-white dark:bg-gray-700"
              value={editableProposed?.description || ''}
              onChange={e => setEditableProposed(p => ({ ...p!, description: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CloudJira;