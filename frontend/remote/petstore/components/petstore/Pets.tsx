import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { PetType } from '../../types';
import { Plus, PawPrint } from 'lucide-react';
import PetStoreLayout from '../PetStoreLayout';
import { usePets } from '../../hooks/usePets';
import { useCustomers } from '../../hooks/useCustomers';

const Pets: React.FC = () => {
  const { allPets } = usePets();
  const { allCustomers } = useCustomers();

  const [showForm, setShowForm] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    type: PetType.DOG,
    ownerId: '',
    birthDate: '',
    notes: ''
  });

  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Router not available in federated module context
  }

  useEffect(() => {
    if (router?.query?.action === 'new') {
      setShowForm(true);
    }
  }, [router?.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Call API directly since we don't have a createPet method in usePets hook
    const postData = {
      ...formData, 
      birthDate: new Date(formData.birthDate).toISOString()
    };
    
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      withCredentials: true,
    };

    try {
      const axios = (await import('axios')).default;
      await axios.post('http://localhost:80/petstore/pet', postData, axiosConfig);
      setFormData({ name: '', type: PetType.DOG, ownerId: '', birthDate: '', notes: '' });
      setShowForm(false);
      window.location.reload(); // Reload to fetch new data
    } catch (error) {
      console.error("Error creating pet:", error);
    }
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Pets</h2>
            <p className="text-gray-500">Registered pets</p>
          </div>
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition"
          >
            <Plus size={18} /> Add Pet
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border">
            <h3 className="text-lg font-semibold mb-4">Register New Pet</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Name" 
                required 
                className="border p-2 dark:bg-gray-700 rounded" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
              <select 
                className="border p-2 dark:bg-gray-700 rounded" 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as PetType})}
              >
                {Object.values(PetType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select 
                className="border p-2 dark:bg-gray-700 rounded" 
                required 
                value={formData.ownerId} 
                onChange={e => setFormData({...formData, ownerId: e.target.value})}
              >
                <option value="">Select Owner</option>
                {allCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input 
                type="date" 
                required 
                className="border p-2 dark:bg-gray-700 rounded" 
                value={formData.birthDate} 
                onChange={e => setFormData({...formData, birthDate: e.target.value})} 
              />
              <input 
                type="text" 
                placeholder="Notes (optional)" 
                className="border p-2 dark:bg-gray-700 rounded md:col-span-2" 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
              <div className="flex gap-2 md:col-span-2">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)} 
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {allPets.map(pet => (
            <div key={pet.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <PawPrint size={24} />
                </div>
                <div>
                  <h3 className="font-bold">{pet.name}</h3>
                  <p className="text-sm text-gray-500">{pet.type}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Owner: {allCustomers.find(o => o.id === pet.ownerId)?.name || 'Unknown'}
              </p>
              {pet.notes && (
                <p className="text-xs text-gray-500 mt-2 italic">{pet.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pets;
