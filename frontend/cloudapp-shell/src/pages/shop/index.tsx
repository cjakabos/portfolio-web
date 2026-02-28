'use client'
import React, { useEffect, useState } from "react";

// Import Custom Hooks
import { useAuth } from "../../hooks/useAuth";
import { useItems } from "../../hooks/useItems";
import { useCart } from "../../hooks/useCart";

const initialFormValues = { name: "", price: "", description: "" };


import { Item, UserOrder } from '../../../types';
import { ShoppingCart, Package, CheckCircle, Plus, X } from 'lucide-react';

const CloudShop: React.FC = () => {

    const [activeTab, setActiveTab] = useState<'SHOP' | 'ORDERS'>('SHOP');


   // 1. Auth
    const { username, isReady, isAdmin } = useAuth();

    // 2. Logic Hooks
    const { items, fetchItems, createItem } = useItems();
    const { cart, history, fetchCart, fetchHistory, addToCart, clearCart, submitOrder } = useCart(username);

    // 3. Local UI State
    const [formValues, setFormValues] = useState(initialFormValues);
    const [modals, setModals] = useState({ item: false, history: false, cart: false });

    // 4. Initial Data Load
    useEffect(() => {
        if (isReady) {
            fetchItems();
            fetchCart();
            fetchHistory();
        }
    }, [isReady, fetchItems, fetchCart, fetchHistory]);

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    // Handle create item submission
    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;
        await createItem(formValues.name, formValues.price, formValues.description);
        setFormValues(initialFormValues);
        setModals(prev => ({ ...prev, item: false }));
    };

    // Open/close modal helpers
    const openItemModal = () => {
        if (!isAdmin) return;
        setModals(prev => ({ ...prev, item: true }));
    };
    const closeItemModal = () => {
        setModals(prev => ({ ...prev, item: false }));
        setFormValues(initialFormValues);
    };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Create Item Modal */}
      {modals.item && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus size={20} className="text-green-600 dark:text-green-400" />
                Create New Item
              </h2>
              <button
                onClick={closeItemModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="Enter item name"
                />
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formValues.price}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formValues.description}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Enter item description"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeItemModal}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Create Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
        <div className="flex items-center gap-4 mb-6 sticky top-0 bg-gray-100 dark:bg-gray-900 pt-1 z-10">
            <button
                onClick={() => setActiveTab('SHOP')}
                className={`text-lg font-bold pb-2 border-b-2 ${activeTab === 'SHOP' ? 'text-gray-900 dark:text-white border-green-500' : 'text-gray-400 border-transparent'}`}
            >
                Store Items
            </button>
            <button
                onClick={() => setActiveTab('ORDERS')}
                className={`text-lg font-bold pb-2 border-b-2 ${activeTab === 'ORDERS' ? 'text-gray-900 dark:text-white border-green-500' : 'text-gray-400 border-transparent'}`}
            >
                My Orders
            </button>
            {isAdmin && (
                <button
                    onClick={openItemModal}
                    className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                    <Plus size={16} />
                    Add Item
                </button>
            )}
        </div>

        {activeTab === 'SHOP' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
                    <div className="mb-4">
                        <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center mb-3">
                            <Package size={24} />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">${item.price.toFixed(2)}</span>
                        <button
                            onClick={() => addToCart(item)}
                            className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition"
                        >
                            Add to Cart
                        </button>
                    </div>
                </div>
            ))}
            </div>
        ) : (
            <div className="space-y-4">
                {history.map(order => (
                    <div key={order.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Paid</span>
                                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">{new Date(order.date!).toLocaleDateString()}</span>
                            </div>
                            <span className="font-mono text-gray-400 text-sm">#{order.id}</span>
                        </div>
                        <div className="space-y-2">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                                    <span className="text-gray-900 dark:text-white font-medium">${item.price}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between font-bold text-gray-900 dark:text-white">
                            <span>Total</span>
                            <span>${order.total}</span>
                        </div>
                    </div>
                ))}
                {history.length === 0 && <div className="text-gray-500 dark:text-gray-400 text-center py-8">No past orders.</div>}
            </div>
        )}
      </div>

      <div className="lg:col-span-1">
         <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sticky top-6 flex flex-col max-h-[calc(100vh-8rem)]">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 shrink-0">
                <ShoppingCart size={20} className="text-green-600 dark:text-green-400"/> Your Cart
            </h3>
{cart.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Cart is empty.</p>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Cart Items List with Scroll */}
                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar mb-4">
                        {cart.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm group p-2 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-lg transition-colors">
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                                    <p className="text-xs text-gray-400">${item.price.toFixed(2)}</p>
                                </div>
                                <button onClick={() => clearCart()} className="text-gray-300 hover:text-red-500 p-1">
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Total Footer */}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0 mt-auto">
                        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white mb-4">
                            <span>Total</span>
                            <span>${cart.total}</span>
                        </div>
                        <button
                            onClick={submitOrder}
                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-100 dark:shadow-green-900/20 flex justify-center items-center gap-2"
                        >
                            <CheckCircle size={18} /> Checkout
                        </button>
                    </div>
                </div>
            )}

         </div>
      </div>
    </div>
  );
};

export default CloudShop;
