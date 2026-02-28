import React, { useEffect } from 'react';
import { useRouter } from 'next/compat/router';
import { Plus, User, Phone } from 'lucide-react';
import PetStoreLayout from '../PetStoreLayout';
import { useCustomers } from '../../hooks/useCustomers';

const PetStoreCustomers: React.FC = () => {
  const {
    customer,
    allCustomers,
    loading,
    handleChange,
    handleCustomerSubmit,
  } = useCustomers();
  
  const [showForm, setShowForm] = React.useState(false);

  const router = useRouter();

  useEffect(() => {
    if (router?.query?.action === 'new') {
      setShowForm(true);
    }
  }, [router?.query?.action]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleCustomerSubmit(e);
    setShowForm(false);
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Customers</h2>
            <p className="text-gray-500">Manage pet owners</p>
          </div>
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
          >
            <Plus size={18} /> New Customer
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Add New Customer</h3>
            <form onSubmit={handleFormSubmit} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                  type="text" 
                  name="name"
                  className="w-full border rounded-lg px-4 py-2 bg-white dark:bg-gray-700" 
                  value={customer.name} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input 
                  type="tel" 
                  name="phoneNumber"
                  className="w-full border rounded-lg px-4 py-2 bg-white dark:bg-gray-700" 
                  value={customer.phoneNumber} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase">Phone</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <User size={16} />
                      </div>
                      {c.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <Phone size={14} className="inline mr-2" />
                      {c.phoneNumber}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{c.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetStoreCustomers;
