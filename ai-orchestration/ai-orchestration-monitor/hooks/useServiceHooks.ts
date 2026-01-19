// ============================================================================
// Service Hooks - React hooks for all backend services
// File: hooks/useServiceHooks.ts
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import orchestrationClient from '../services/orchestrationClient';
import type {
  ToolInfo,
  ToolCategory,
  ToolInvocationResponse,
  CloudAppItem,
  CloudAppFile,
  Cart,
  Order,
  Note,
  Employee,
  Customer,
  Pet,
  Schedule,
  Vehicle,
  SegmentationCustomer,
  MLInfo,
  MLDiagnostics,
  ApprovalRequest,
  ApprovalHistoryItem,
  RecentError,
  WebProxyResponse,
} from '../types';

// ============================================================================
// TOOLS HOOK
// ============================================================================

export function useTools() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await orchestrationClient.discoverTools();
      setTools(response.tools);
      setCategories(response.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const invokeTool = useCallback(async (toolName: string, parameters: Record<string, any>): Promise<ToolInvocationResponse> => {
    return orchestrationClient.invokeTool(toolName, parameters);
  }, []);

  useEffect(() => { loadTools(); }, [loadTools]);

  return { tools, categories, isLoading, error, refresh: loadTools, invokeTool };
}

// ============================================================================
// CLOUDAPP HOOKS
// ============================================================================

export function useCloudAppItems() {
  const [items, setItems] = useState<CloudAppItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getItems();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchItems = useCallback(async (name: string): Promise<CloudAppItem[]> => {
    return orchestrationClient.searchItemsByName(name);
  }, []);

  // NEW: Create item method
  const createItem = useCallback(async (name: string, price: number, description?: string): Promise<CloudAppItem> => {
    const item = await orchestrationClient.createItem(name, price, description);
    await loadItems();
    return item;
  }, [loadItems]);

  useEffect(() => { loadItems(); }, [loadItems]);

  return { items, isLoading, error, refresh: loadItems, searchItems, createItem };
}

export function useCloudAppCart(username: string) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getCart(username);
      setCart(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cart');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const addToCart = useCallback(async (itemId: number, quantity: number = 1): Promise<Cart> => {
    const updated = await orchestrationClient.addToCart(username, itemId, quantity);
    setCart(updated);
    return updated;
  }, [username]);

  const removeFromCart = useCallback(async (itemId: number, quantity: number = 1): Promise<Cart> => {
    const updated = await orchestrationClient.removeFromCart(username, itemId, quantity);
    setCart(updated);
    return updated;
  }, [username]);

  const clearCart = useCallback(async (): Promise<void> => {
    await orchestrationClient.clearCart(username);
    setCart({ items: [], total: 0 });
  }, [username]);

  useEffect(() => { loadCart(); }, [loadCart]);

  return { cart, isLoading, error, refresh: loadCart, addToCart, removeFromCart, clearCart };
}

export function useCloudAppOrders(username: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getOrderHistory(username);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const submitOrder = useCallback(async (): Promise<Order> => {
    const order = await orchestrationClient.submitOrder(username);
    await loadOrders();
    return order;
  }, [username, loadOrders]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  return { orders, isLoading, error, refresh: loadOrders, submitOrder };
}

export function useCloudAppNotes(username: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getUserNotes(username);
      setNotes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const addNote = useCallback(async (title: string, description: string): Promise<Note> => {
    const note = await orchestrationClient.addNote(username, title, description);
    await loadNotes();
    return note;
  }, [username, loadNotes]);

  const updateNote = useCallback(async (noteId: number, title: string, description: string): Promise<Note> => {
    const note = await orchestrationClient.updateNote(noteId, title, description);
    await loadNotes();
    return note;
  }, [loadNotes]);

  const deleteNote = useCallback(async (noteId: number): Promise<void> => {
    await orchestrationClient.deleteNote(noteId);
    await loadNotes();
  }, [loadNotes]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  return { notes, isLoading, error, refresh: loadNotes, addNote, updateNote, deleteNote };
}

// ============================================================================
// CLOUDAPP FILES HOOK (NEW)
// ============================================================================

export function useCloudAppFiles(username: string) {
  const [files, setFiles] = useState<CloudAppFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getUserFiles(username);
      setFiles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const uploadFile = useCallback(async (file: File): Promise<CloudAppFile> => {
    const uploadedFile = await orchestrationClient.uploadFile(username, file);
    await loadFiles();
    return uploadedFile;
  }, [username, loadFiles]);

  const downloadFile = useCallback(async (fileId: number): Promise<Blob> => {
    return orchestrationClient.getFile(fileId);
  }, []);

  const deleteFile = useCallback(async (fileId: number): Promise<void> => {
    await orchestrationClient.deleteFile(fileId);
    await loadFiles();
  }, [loadFiles]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  return { files, isLoading, error, refresh: loadFiles, uploadFile, downloadFile, deleteFile };
}

// ============================================================================
// PETSTORE HOOKS
// ============================================================================

export function usePetstoreEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getEmployees();
      setEmployees(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEmployee = useCallback(async (name: string, skills: string[], daysAvailable: string[]): Promise<Employee> => {
    const employee = await orchestrationClient.createEmployee(name, skills, daysAvailable);
    await loadEmployees();
    return employee;
  }, [loadEmployees]);

  const setAvailability = useCallback(async (employeeId: number, daysAvailable: string[]): Promise<void> => {
    await orchestrationClient.setEmployeeAvailability(employeeId, daysAvailable);
    await loadEmployees();
  }, [loadEmployees]);

  const findAvailable = useCallback(async (skills: string[], date: string): Promise<Employee[]> => {
    return orchestrationClient.findAvailableEmployees(skills, date);
  }, []);

  const deleteEmployee = useCallback(async (employeeId: number): Promise<void> => {
    await orchestrationClient.deleteEmployee(employeeId);
    await loadEmployees();
  }, [loadEmployees]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  return { employees, isLoading, error, refresh: loadEmployees, createEmployee, setAvailability, findAvailable, deleteEmployee };
}

export function usePetstoreCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCustomer = useCallback(async (name: string, phoneNumber: string, notes?: string): Promise<Customer> => {
    const customer = await orchestrationClient.createCustomer(name, phoneNumber, notes);
    await loadCustomers();
    return customer;
  }, [loadCustomers]);

  const getByPet = useCallback(async (petId: number): Promise<Customer> => {
    return orchestrationClient.getCustomerByPet(petId);
  }, []);

  const deleteCustomer = useCallback(async (customerId: number): Promise<void> => {
    await orchestrationClient.deleteCustomer(customerId);
    await loadCustomers();
  }, [loadCustomers]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  return { customers, isLoading, error, refresh: loadCustomers, createCustomer, getByPet, deleteCustomer };
}

export function usePetstorePets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getPets();
      setPets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPet = useCallback(async (type: string, name: string, ownerId: number, birthDate?: string, notes?: string): Promise<Pet> => {
    const pet = await orchestrationClient.createPet(type, name, ownerId, birthDate, notes);
    await loadPets();
    return pet;
  }, [loadPets]);

  const updatePet = useCallback(async (petId: number, updates: Partial<Pet>): Promise<Pet> => {
    const pet = await orchestrationClient.updatePet(petId, updates);
    await loadPets();
    return pet;
  }, [loadPets]);

  const getByOwner = useCallback(async (ownerId: number): Promise<Pet[]> => {
    return orchestrationClient.getPetsByOwner(ownerId);
  }, []);

  // NEW: Delete pet method
  const deletePet = useCallback(async (petId: number): Promise<void> => {
    await orchestrationClient.deletePet(petId);
    await loadPets();
  }, [loadPets]);

  useEffect(() => { loadPets(); }, [loadPets]);

  return { pets, isLoading, error, refresh: loadPets, createPet, updatePet, getByOwner, deletePet };
}

export function usePetstoreSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getSchedules();
      setSchedules(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createSchedule = useCallback(async (date: string, employeeIds: number[], petIds: number[], activities: string[]): Promise<Schedule> => {
    const schedule = await orchestrationClient.createSchedule(date, employeeIds, petIds, activities);
    await loadSchedules();
    return schedule;
  }, [loadSchedules]);

  const getByEmployee = useCallback(async (employeeId: number): Promise<Schedule[]> => {
    return orchestrationClient.getEmployeeSchedule(employeeId);
  }, []);

  const getByPet = useCallback(async (petId: number): Promise<Schedule[]> => {
    return orchestrationClient.getPetSchedule(petId);
  }, []);

  // NEW: Delete schedule method
  const deleteSchedule = useCallback(async (scheduleId: number): Promise<void> => {
    await orchestrationClient.deleteSchedule(scheduleId);
    await loadSchedules();
  }, [loadSchedules]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  return { schedules, isLoading, error, refresh: loadSchedules, createSchedule, getByEmployee, getByPet, deleteSchedule };
}

// ============================================================================
// VEHICLES HOOK
// ============================================================================

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orchestrationClient.getVehicles();
      setVehicles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createVehicle = useCallback(async (vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
    const created = await orchestrationClient.createVehicle(vehicle);
    await loadVehicles();
    return created;
  }, [loadVehicles]);

  const updateVehicle = useCallback(async (vehicleId: number, updates: Partial<Vehicle>): Promise<Vehicle> => {
    const updated = await orchestrationClient.updateVehicle(vehicleId, updates);
    await loadVehicles();
    return updated;
  }, [loadVehicles]);

  const deleteVehicle = useCallback(async (vehicleId: number): Promise<void> => {
    await orchestrationClient.deleteVehicle(vehicleId);
    await loadVehicles();
  }, [loadVehicles]);

  const searchByMake = useCallback(async (make: string): Promise<Vehicle[]> => {
    return orchestrationClient.searchVehiclesByMake(make);
  }, []);

  const searchByModel = useCallback(async (model: string): Promise<Vehicle[]> => {
    return orchestrationClient.searchVehiclesByModel(model);
  }, []);

  const searchByYear = useCallback(async (year: number): Promise<Vehicle[]> => {
    return orchestrationClient.searchVehiclesByYear(year);
  }, []);

  const searchByPriceRange = useCallback(async (minPrice: number, maxPrice: number): Promise<Vehicle[]> => {
    return orchestrationClient.searchVehiclesByPriceRange(minPrice, maxPrice);
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  return {
    vehicles, isLoading, error, refresh: loadVehicles,
    createVehicle, updateVehicle, deleteVehicle,
    searchByMake, searchByModel, searchByYear, searchByPriceRange
  };
}

// ============================================================================
// ML PIPELINE HOOK
// ============================================================================

export function useMLPipeline() {
  const [customers, setCustomers] = useState<SegmentationCustomer[]>([]);
  const [mlInfo, setMlInfo] = useState<MLInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<MLDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await orchestrationClient.getSegmentationCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    }
  }, []);

  const loadMLInfo = useCallback(async (sampleSize: number = -2) => {
    try {
      const data = await orchestrationClient.getMLInfo(sampleSize);
      setMlInfo(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ML info');
    }
  }, []);

  const loadDiagnostics = useCallback(async () => {
    try {
      const data = await orchestrationClient.getMLDiagnostics();
      setDiagnostics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics');
    }
  }, []);

  const addCustomer = useCallback(async (gender: string, age: number, annualIncome: number, spendingScore: number): Promise<SegmentationCustomer> => {
    const customer = await orchestrationClient.addSegmentationCustomer(gender, age, annualIncome, spendingScore);
    await loadCustomers();
    return customer;
  }, [loadCustomers]);

  const getPredictions = useCallback(async (filepath: string): Promise<number[]> => {
    return orchestrationClient.getModelPredictions(filepath);
  }, []);

  const getScore = useCallback(async (): Promise<{ score: number }> => {
    return orchestrationClient.getModelScore();
  }, []);

  const getStats = useCallback(async (): Promise<any> => {
    return orchestrationClient.getSummaryStatistics();
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadCustomers(), loadMLInfo(), loadDiagnostics()]);
    setIsLoading(false);
  }, [loadCustomers, loadMLInfo, loadDiagnostics]);

  useEffect(() => { refreshAll(); }, []);

  return {
    customers, mlInfo, diagnostics, isLoading, error,
    refresh: refreshAll, addCustomer, loadMLInfo, getPredictions, getScore, getStats
  };
}

// ============================================================================
// WEB PROXY HOOK (NEW)
// ============================================================================

export function useWebProxy() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<WebProxyResponse | null>(null);

  const proxyGet = useCallback(async (webDomain: string, webApiKey: string): Promise<WebProxyResponse> => {
    setIsLoading(true);
    try {
      const response = await orchestrationClient.proxyGet(webDomain, webApiKey);
      setLastResponse(response);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proxy GET request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const proxyPost = useCallback(async (webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> => {
    setIsLoading(true);
    try {
      const response = await orchestrationClient.proxyPost(webDomain, webApiKey, body);
      setLastResponse(response);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proxy POST request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const proxyPut = useCallback(async (webDomain: string, webApiKey: string, body: Record<string, unknown>): Promise<WebProxyResponse> => {
    setIsLoading(true);
    try {
      const response = await orchestrationClient.proxyPut(webDomain, webApiKey, body);
      setLastResponse(response);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proxy PUT request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const proxyDelete = useCallback(async (webDomain: string, webApiKey: string): Promise<WebProxyResponse> => {
    setIsLoading(true);
    try {
      const response = await orchestrationClient.proxyDelete(webDomain, webApiKey);
      setLastResponse(response);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proxy DELETE request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, lastResponse, proxyGet, proxyPost, proxyPut, proxyDelete };
}

// ============================================================================
// APPROVALS HOOK
// ============================================================================

export function useApprovals(autoRefresh: boolean = true, refreshInterval: number = 5000) {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const data = await orchestrationClient.getPendingApprovals();
      setPendingApprovals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadApprovalHistory = useCallback(async (limit: number = 50) => {
    try {
      const data = await orchestrationClient.getApprovalHistory({ limit });
      setApprovalHistory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval history');
    }
  }, []);

  const approveRequest = useCallback(async (requestId: string, approverId: number, notes?: string): Promise<void> => {
    await orchestrationClient.approveRequest(requestId, approverId, notes);
    await loadPendingApprovals();
    await loadApprovalHistory();
  }, [loadPendingApprovals, loadApprovalHistory]);

  const rejectRequest = useCallback(async (requestId: string, approverId: number, notes?: string): Promise<void> => {
    await orchestrationClient.rejectRequest(requestId, approverId, notes);
    await loadPendingApprovals();
    await loadApprovalHistory();
  }, [loadPendingApprovals, loadApprovalHistory]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadPendingApprovals(), loadApprovalHistory()]);
    setIsLoading(false);
  }, [loadPendingApprovals, loadApprovalHistory]);

  useEffect(() => {
    refreshAll();

    if (autoRefresh) {
      const interval = setInterval(loadPendingApprovals, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshAll, autoRefresh, refreshInterval, loadPendingApprovals]);

  return {
    pendingApprovals,
    approvalHistory,
    isLoading,
    error,
    refresh: refreshAll,
    approveRequest,
    rejectRequest,
  };
}

// ============================================================================
// RECENT ERRORS HOOK
// ============================================================================

export function useRecentErrors(limit: number = 50, autoRefresh: boolean = true, refreshInterval: number = 30000) {
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    try {
      const response = await orchestrationClient.getRecentErrors(limit);
      setErrors(response.errors);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent errors');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadErrors();

    if (autoRefresh) {
      const interval = setInterval(loadErrors, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadErrors, autoRefresh, refreshInterval]);

  return { errors, total, isLoading, error, refresh: loadErrors };
}