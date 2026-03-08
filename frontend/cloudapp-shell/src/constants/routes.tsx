import React from 'react';
import { LayoutGrid, Folder, ShoppingCart, MessageSquare, Cat, Trello, Map, Brain, Bot } from 'lucide-react';

export interface RouteItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly: boolean;
}

export const allAuthedRoutes: RouteItem[] = [
  { label: 'Home', path: '/', icon: <LayoutGrid size={20} />, adminOnly: false },
  { label: 'Files & Notes', path: '/files', icon: <Folder size={20} />, adminOnly: false },
  { label: 'Shop', path: '/shop', icon: <ShoppingCart size={20} />, adminOnly: false },
  { label: 'Chat', path: '/chat', icon: <MessageSquare size={20} />, adminOnly: false },
  { label: 'Maps', path: '/maps', icon: <Map size={20} />, adminOnly: false },
  { label: 'GPT', path: '/chatllm', icon: <Bot size={20} />, adminOnly: false },
  { label: 'Jira', path: '/jira', icon: <Trello size={20} />, adminOnly: true },
  { label: 'MLOps', path: '/mlops', icon: <Brain size={20} />, adminOnly: true },
  { label: 'PetStore', path: '/petstore', icon: <Cat size={20} />, adminOnly: true },
];
