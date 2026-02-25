import React from 'react';
import { LayoutGrid, FileText, Folder, ShoppingCart, MessageSquare, Cat, Trello, Map, Brain, Bot } from 'lucide-react';

export interface RouteItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

export const allAuthedRoutes: RouteItem[] = [
  { label: 'Dashboard', path: '/', icon: <LayoutGrid size={20} />, adminOnly: false },
  { label: 'Jira', path: '/jira', icon: <Trello size={20} />, adminOnly: true },
  { label: 'Notes', path: '/notes', icon: <FileText size={20} />, adminOnly: false },
  { label: 'Files', path: '/files', icon: <Folder size={20} />, adminOnly: false },
  { label: 'Shop', path: '/shop', icon: <ShoppingCart size={20} />, adminOnly: false },
  { label: 'Chat', path: '/chat', icon: <MessageSquare size={20} />, adminOnly: false },
  { label: 'Maps', path: '/maps', icon: <Map size={20} />, adminOnly: false },
  { label: 'MLOps', path: '/mlops', icon: <Brain size={20} />, adminOnly: true },
  { label: 'GPT', path: '/chatllm', icon: <Bot size={20} />, adminOnly: false },
  { label: 'PetStore', path: '/petstore', icon: <Cat size={20} />, adminOnly: true },
];
