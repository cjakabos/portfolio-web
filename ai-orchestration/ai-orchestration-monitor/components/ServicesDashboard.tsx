// =============================================================================
// ServicesDashboard - CloudApp, Petstore, Vehicles Service Explorer
// =============================================================================
// Fully integrated with backend - no mock data
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Users, ShoppingCart, Package, PawPrint, Calendar,
  Car, RefreshCw, Loader2, AlertCircle, CheckCircle, Plus,
  Trash2, Eye, Search, Filter
} from 'lucide-react';
import { orchestrationClient } from '../services/orchestrationClient';
import type {
  CloudAppItem, Cart, Order, Note, Employee, Customer, Pet, Schedule, Vehicle
} from '../types';

interface ServicesDashboardProps {
  embedded?: boolean;
}

type ServiceTab = 'cloudapp' | 'petstore' | 'vehicles';
type CloudAppSection = 'items' | 'cart' | 'orders' | 'notes';
type PetstoreSection = 'employees' | 'customers' | 'pets' | 'schedules';

export default function ServicesDashboard({ embedded = false }: ServicesDashboardProps) {
  const [activeService, setActiveService] = useState<ServiceTab>('cloudapp');
  const [cloudAppSection, setCloudAppSection] = useState<CloudAppSection>('items');
  const [petstoreSection, setPetstoreSection] = useState<PetstoreSection>('employees');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [items, setItems] = useState<CloudAppItem[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // Form states
  const [username, setUsername] = useState('demo_user');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch functions
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getItems();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getCart(username);
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cart');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const fetchOrders = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getOrderHistory(username);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const fetchNotes = useCallback(async () => {
    if (!username) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getUserNotes(username);
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getEmployees();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getPets();
      setPets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getSchedules();
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orchestrationClient.getVehicles();
      setVehicles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vehicles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data based on active view
  useEffect(() => {
    if (activeService === 'cloudapp') {
      switch (cloudAppSection) {
        case 'items': fetchItems(); break;
        case 'cart': fetchCart(); break;
        case 'orders': fetchOrders(); break;
        case 'notes': fetchNotes(); break;
      }
    } else if (activeService === 'petstore') {
      switch (petstoreSection) {
        case 'employees': fetchEmployees(); break;
        case 'customers': fetchCustomers(); break;
        case 'pets': fetchPets(); break;
        case 'schedules': fetchSchedules(); break;
      }
    } else if (activeService === 'vehicles') {
      fetchVehicles();
    }
  }, [activeService, cloudAppSection, petstoreSection, fetchItems, fetchCart, fetchOrders, fetchNotes, fetchEmployees, fetchCustomers, fetchPets, fetchSchedules, fetchVehicles]);

  // Cart actions
  const handleAddToCart = async (itemId: number) => {
    try {
      const updatedCart = await orchestrationClient.addToCart(username, itemId, 1);
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to cart');
    }
  };

  const handleRemoveFromCart = async (itemId: number) => {
    try {
      const updatedCart = await orchestrationClient.removeFromCart(username, itemId, 1);
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove from cart');
    }
  };

  // Service tabs
  const ServiceTab = ({ id, icon: Icon, label }: { id: ServiceTab; icon: React.ElementType; label: string }) => (
    <button
      onClick={() => setActiveService(id)}
      className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeService === id
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  return (
    <div className={`${embedded ? '' : 'p-6 max-w-7xl mx-auto'}`}>
      {/* Header */}
      {!embedded && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Services Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Explore and interact with backend services
          </p>
        </div>
      )}

      {/* Service Tabs */}
      <div className="mb-6 flex items-center space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
        <ServiceTab id="cloudapp" icon={Store} label="CloudApp" />
        <ServiceTab id="petstore" icon={PawPrint} label="Petstore" />
        <ServiceTab id="vehicles" icon={Car} label="Vehicles" />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* CloudApp Service */}
      {activeService === 'cloudapp' && (
        <div className="space-y-6">
          {/* User Context */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48"
                placeholder="Enter username"
              />
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex space-x-2">
            {(['items', 'cart', 'orders', 'notes'] as CloudAppSection[]).map(section => (
              <button
                key={section}
                onClick={() => setCloudAppSection(section)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                  cloudAppSection === section
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-500">Loading...</span>
              </div>
            ) : cloudAppSection === 'items' ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(item => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bold text-blue-600">${item.price.toFixed(2)}</span>
                        <button
                          onClick={() => handleAddToCart(item.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No items available
                    </div>
                  )}
                </div>
              </div>
            ) : cloudAppSection === 'cart' ? (
              <div className="p-6">
                {cart && cart.items.length > 0 ? (
                  <div className="space-y-4">
                    {cart.items.map(item => (
                      <div key={item.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{item.itemName}</span>
                          <span className="text-sm text-gray-500 ml-2">x{item.quantity}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-medium">${item.price.toFixed(2)}</span>
                          <button
                            onClick={() => handleRemoveFromCart(item.itemId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                      <span className="font-bold text-lg">Total:</span>
                      <span className="font-bold text-lg text-blue-600">${cart.total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Cart is empty</p>
                  </div>
                )}
              </div>
            ) : cloudAppSection === 'orders' ? (
              <div className="p-6">
                {orders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.map(order => (
                      <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">Order #{order.id}</span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{order.items.length} items • ${order.total.toFixed(2)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No orders yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6">
                {notes.length > 0 ? (
                  <div className="space-y-3">
                    {notes.map(note => (
                      <div key={note.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900">{note.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{note.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No notes found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Petstore Service */}
      {activeService === 'petstore' && (
        <div className="space-y-6">
          {/* Section Tabs */}
          <div className="flex space-x-2">
            {(['employees', 'customers', 'pets', 'schedules'] as PetstoreSection[]).map(section => (
              <button
                key={section}
                onClick={() => setPetstoreSection(section)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                  petstoreSection === section
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-500">Loading...</span>
              </div>
            ) : petstoreSection === 'employees' ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map(emp => (
                    <div key={emp.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{emp.name}</h4>
                          <p className="text-xs text-gray-500">ID: {emp.id}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Skills</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {emp.skills.map(skill => (
                              <span key={skill} className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Available</p>
                          <p className="text-sm text-gray-700">{emp.daysAvailable.join(', ') || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No employees found
                    </div>
                  )}
                </div>
              </div>
            ) : petstoreSection === 'customers' ? (
              <div className="p-6">
                <div className="space-y-3">
                  {customers.map(cust => (
                    <div key={cust.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{cust.name}</h4>
                        <p className="text-sm text-gray-500">{cust.phoneNumber}</p>
                        {cust.notes && <p className="text-sm text-gray-400 mt-1">{cust.notes}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">
                          {cust.petIds?.length || 0} pets
                        </span>
                      </div>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No customers found
                    </div>
                  )}
                </div>
              </div>
            ) : petstoreSection === 'pets' ? (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pets.map(pet => (
                    <div key={pet.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <PawPrint className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{pet.name}</h4>
                          <p className="text-xs text-gray-500 capitalize">{pet.type}</p>
                        </div>
                      </div>
                      {pet.birthDate && (
                        <p className="text-sm text-gray-500">Born: {pet.birthDate}</p>
                      )}
                      {pet.notes && (
                        <p className="text-sm text-gray-400 mt-1">{pet.notes}</p>
                      )}
                    </div>
                  ))}
                  {pets.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No pets found
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-3">
                  {schedules.map(schedule => (
                    <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900">{schedule.date}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {schedule.employeeIds.length} employees, {schedule.petIds.length} pets
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {schedule.activities.map(activity => (
                          <span key={activity} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {activity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {schedules.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No schedules found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vehicles Service */}
      {activeService === 'vehicles' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-500">Loading vehicles...</span>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehicles.map(vehicle => (
                    <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Car className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {vehicle.details?.manufacturer} {vehicle.details?.model}
                          </h4>
                          <p className="text-sm text-gray-500">{vehicle.details?.year}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Condition</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            vehicle.condition === 'new' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {vehicle.condition}
                          </span>
                        </div>
                        {vehicle.details?.price && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Price</span>
                            <span className="font-bold text-blue-600">
                              ${vehicle.details.price.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {vehicle.details?.mileage && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Mileage</span>
                            <span className="text-gray-900">
                              {vehicle.details.mileage.toLocaleString()} mi
                            </span>
                          </div>
                        )}
                        {vehicle.location?.city && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Location</span>
                            <span className="text-gray-900">
                              {vehicle.location.city}, {vehicle.location.state}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {vehicles.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No vehicles found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
