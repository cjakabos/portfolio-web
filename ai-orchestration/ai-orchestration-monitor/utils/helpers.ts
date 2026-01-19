// ============================================================================
// Utility Functions and Constants
// File: utils/helpers.ts
// ============================================================================

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================================================
// COLOR FUNCTIONS
// ============================================================================

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    running: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    stopped: 'bg-blue-100 text-blue-800',
    completed: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    expired: 'bg-gray-100 text-gray-800 border-gray-200',
    closed: 'bg-green-100 text-green-800',
    open: 'bg-red-100 text-red-800',
    half_open: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[risk] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-600 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    high: 'text-orange-600 bg-orange-50',
    critical: 'text-red-600 bg-red-50',
  };
  return colors[severity] || 'text-gray-600 bg-gray-50';
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    network: 'text-blue-600 bg-blue-50 border-blue-200',
    rate_limit: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    validation: 'text-purple-600 bg-purple-50 border-purple-200',
    authentication: 'text-red-600 bg-red-50 border-red-200',
    external_service: 'text-green-600 bg-green-50 border-green-200',
    tool_error: 'text-orange-600 bg-orange-50 border-orange-200',
    database: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    timeout: 'text-pink-600 bg-pink-50 border-pink-200',
  };
  return colors[category] || 'text-gray-600 bg-gray-50 border-gray-200';
}

export function getServiceColor(service: string): string {
  const colors: Record<string, string> = {
    cloudapp: 'text-blue-600 bg-blue-50 border-blue-200',
    petstore: 'text-green-600 bg-green-50 border-green-200',
    vehicles: 'text-purple-600 bg-purple-50 border-purple-200',
    ml_pipeline: 'text-orange-600 bg-orange-50 border-orange-200',
    web_proxy: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  };
  return colors[service] || 'text-gray-600 bg-gray-50 border-gray-200';
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\d{3}-\d{3}-\d{4}$|^\d{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// TIME HELPERS
// ============================================================================

export function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateString);
}

export function getTimeRemaining(expiresAt: string): string {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expired';
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffMin < 60) return `${diffMin}m remaining`;
  if (diffHour < 24) return `${diffHour}h remaining`;
  return formatDateTime(expiresAt);
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PETSTORE_SKILLS = ['PETTING', 'WALKING', 'FEEDING', 'MEDICATING', 'SHAVING'] as const;
export type PetstoreSkill = typeof PETSTORE_SKILLS[number];

export const PETSTORE_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type PetstoreDay = typeof PETSTORE_DAYS[number];

export const PET_TYPES = ['CAT', 'DOG', 'LIZARD', 'BIRD', 'FISH', 'SNAKE', 'OTHER'] as const;
export type PetType = typeof PET_TYPES[number];

export const VEHICLE_CONDITIONS = ['NEW', 'USED'] as const;
export type VehicleCondition = typeof VEHICLE_CONDITIONS[number];

export const FUEL_TYPES = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen'] as const;
export type FuelType = typeof FUEL_TYPES[number];

export const BODY_TYPES = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Hatchback', 'Wagon', 'Convertible', 'Van'] as const;
export type BodyType = typeof BODY_TYPES[number];

export const APPROVAL_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type ApprovalRiskLevel = typeof APPROVAL_RISK_LEVELS[number];

export const ERROR_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ErrorSeverity = typeof ERROR_SEVERITIES[number];

export const ERROR_CATEGORIES = [
  'network', 'rate_limit', 'validation', 'authentication',
  'external_service', 'tool_error', 'database', 'timeout',
] as const;
export type ErrorCategory = typeof ERROR_CATEGORIES[number];

export const TOOL_CATEGORIES = {
  cloudapp: { name: 'CloudApp', description: 'Users, Rooms, Items, Cart, Orders, Notes', color: 'blue', toolCount: 20 },
  petstore: { name: 'Petstore', description: 'Employees, Customers, Pets, Schedules', color: 'green', toolCount: 21 },
  vehicles: { name: 'Vehicles', description: 'Vehicle inventory management', color: 'purple', toolCount: 9 },
  ml_pipeline: { name: 'ML Pipeline', description: 'Segmentation, Predictions, Diagnostics', color: 'orange', toolCount: 7 },
  web_proxy: { name: 'Web Proxy', description: 'External API calls, Jira integration', color: 'cyan', toolCount: 5 },
} as const;

export const EXPERIMENT_STATUSES = ['draft', 'running', 'paused', 'stopped', 'completed'] as const;
export type ExperimentStatus = typeof EXPERIMENT_STATUSES[number];

export const CIRCUIT_BREAKER_STATES = ['closed', 'open', 'half_open'] as const;
export type CircuitBreakerState = typeof CIRCUIT_BREAKER_STATES[number];

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  baseUrl: 'http://localhost:8700',
  timeout: 30000,
  retries: 3,
  services: {
    cloudapp: '',
    petstore: '/petstore',
    vehicles: '/vehicles',
    ml: '/ml',
    proxy: '/proxy',
    tools: '/tools',
    approvals: '/approvals',
    errors: '/errors',
  },
};
