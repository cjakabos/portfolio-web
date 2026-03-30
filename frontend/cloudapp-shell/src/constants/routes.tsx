import React from 'react';
import {
  Brain,
  Bot,
  Cat,
  Folder,
  LayoutGrid,
  Map,
  MessageSquare,
  ShoppingCart,
  Trello,
  type LucideIcon,
} from 'lucide-react';
import type { RemoteModuleKey, RemoteModuleStatusMap } from '../lib/remoteModules';

type IconRendererProps = {
  className?: string;
  size?: number;
};

const renderIcon = (Icon: LucideIcon) => {
  const IconRenderer = function RouteIcon({
    className,
    size = 20,
  }: IconRendererProps = {}) {
    return <Icon className={className} size={size} />;
  };

  IconRenderer.displayName = `${Icon.displayName || Icon.name || 'Route'}Icon`;
  return IconRenderer;
};

export interface RouteItem {
  id: string;
  label: string;
  path: string;
  icon: (props?: IconRendererProps) => React.ReactNode;
  adminOnly: boolean;
  remoteKey?: RemoteModuleKey;
  homeDescription?: string;
  homeColorClass?: string;
  homeIconClassName?: string;
}

export const allAuthedRoutes: RouteItem[] = [
  { id: 'home', label: 'Home', path: '/', icon: renderIcon(LayoutGrid), adminOnly: false },
  {
    id: 'files',
    label: 'Files & Notes',
    path: '/files',
    icon: renderIcon(Folder),
    adminOnly: false,
    homeDescription: 'Manage your files and personal notes',
    homeColorClass: 'bg-blue-500/10',
    homeIconClassName: 'text-blue-500',
  },
  {
    id: 'shop',
    label: 'Shop',
    path: '/shop',
    icon: renderIcon(ShoppingCart),
    adminOnly: false,
    homeDescription: 'Purchase items and revisit order history',
    homeColorClass: 'bg-green-500/10',
    homeIconClassName: 'text-green-500',
  },
  {
    id: 'chat',
    label: 'Chat',
    path: '/chat',
    icon: renderIcon(MessageSquare),
    adminOnly: false,
    homeDescription: 'Join real-time rooms and share room codes',
    homeColorClass: 'bg-purple-500/10',
    homeIconClassName: 'text-purple-500',
  },
  {
    id: 'maps',
    label: 'Maps',
    path: '/maps',
    icon: renderIcon(Map),
    adminOnly: false,
    remoteKey: 'openmaps',
    homeDescription: 'Showcase routed vehicle tracking through OpenMaps',
    homeColorClass: 'bg-orange-500/10',
    homeIconClassName: 'text-orange-500',
  },
  {
    id: 'chatllm',
    label: 'GPT',
    path: '/chatllm',
    icon: renderIcon(Bot),
    adminOnly: false,
    remoteKey: 'chatllm',
    homeDescription: 'Opt-in local AI chat for the extended showcase',
    homeColorClass: 'bg-teal-500/10',
    homeIconClassName: 'text-teal-500',
  },
  {
    id: 'jira',
    label: 'Jira',
    path: '/jira',
    icon: renderIcon(Trello),
    adminOnly: true,
    remoteKey: 'jira',
    homeDescription: 'Opt-in admin issue workflow and refinement demo',
    homeColorClass: 'bg-blue-600/10',
    homeIconClassName: 'text-blue-600',
  },
  {
    id: 'mlops',
    label: 'MLOps',
    path: '/mlops',
    icon: renderIcon(Brain),
    adminOnly: true,
    remoteKey: 'mlops',
    homeDescription: 'Opt-in segmentation workflow for extended demos',
    homeColorClass: 'bg-pink-500/10',
    homeIconClassName: 'text-pink-500',
  },
  {
    id: 'petstore',
    label: 'PetStore',
    path: '/petstore',
    icon: renderIcon(Cat),
    adminOnly: true,
    remoteKey: 'petstore',
    homeDescription: 'Opt-in business-domain breadth remote',
    homeColorClass: 'bg-indigo-500/10',
    homeIconClassName: 'text-indigo-500',
  },
];

const matchesRoute = (pathname: string, route: RouteItem) =>
  route.path === '/'
    ? pathname === '/'
    : pathname === route.path || pathname.startsWith(`${route.path}/`);

export const findAuthedRoute = (pathname: string) =>
  allAuthedRoutes.find((route) => matchesRoute(pathname, route));

const isRemoteRouteVisible = (
  route: RouteItem,
  remoteStatus: RemoteModuleStatusMap | undefined,
  remoteStatusLoaded: boolean,
) => {
  if (!route.remoteKey) {
    return true;
  }

  const status = remoteStatus?.[route.remoteKey];
  if (!status || !status.enabled) {
    return false;
  }
  if (status.available === false) {
    return false;
  }
  if (status.available === true) {
    return true;
  }

  return remoteStatusLoaded ? true : status.showWhileChecking;
};

export const getVisibleAuthedRoutes = ({
  isAdmin,
  remoteStatus,
  remoteStatusLoaded,
}: {
  isAdmin: boolean;
  remoteStatus?: RemoteModuleStatusMap;
  remoteStatusLoaded: boolean;
}) =>
  allAuthedRoutes.filter(
    (route) =>
      (!route.adminOnly || isAdmin) &&
      isRemoteRouteVisible(route, remoteStatus, remoteStatusLoaded),
  );

export const getVisibleDashboardRoutes = ({
  isAdmin,
  remoteStatus,
  remoteStatusLoaded,
}: {
  isAdmin: boolean;
  remoteStatus?: RemoteModuleStatusMap;
  remoteStatusLoaded: boolean;
}) =>
  getVisibleAuthedRoutes({
    isAdmin,
    remoteStatus,
    remoteStatusLoaded,
  }).filter((route) => route.path !== '/' && route.homeDescription);
