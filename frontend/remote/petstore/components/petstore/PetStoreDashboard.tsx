import React, { useEffect, useState } from 'react';
import { Users, Cat, Calendar, Briefcase, ChevronRight } from 'lucide-react';
import { usePetStoreNavigation } from '../PetStoreApp';
import { useCustomers } from '../../hooks/useCustomers';
import { usePets } from '../../hooks/usePets';
import { useEmployees } from '../../hooks/useEmployees';
import { useSchedules } from '../../hooks/useSchedules';

const PetStoreDashboard: React.FC = () => {
  const { navigate } = usePetStoreNavigation();
  const { allCustomers } = useCustomers();
  const { allPets } = usePets();
  const { allEmployees } = useEmployees();
  const { schedules } = useSchedules();
  
  const [petData, setPetData] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    // Calculate pet type counts
    const typeCounts: Record<string, number> = {};
    allPets.forEach(pet => { 
      if (pet.type) {
        typeCounts[pet.type] = (typeCounts[pet.type] || 0) + 1;
      }
    });
    setPetData(Object.keys(typeCounts).map(key => ({ name: key, value: typeCounts[key] })));
  }, [allPets]);

  const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">PetStore Dashboard</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button type="button" onClick={() => navigate('customers', 'dashboard')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between text-left transition hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Customers</p>
                <p className="text-3xl font-bold mt-1">{allCustomers.length}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 p-3 rounded-full text-white"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  <Users size={24} />
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            </button>
            <button type="button" onClick={() => navigate('pets', 'dashboard')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between text-left transition hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Pets</p>
                <p className="text-3xl font-bold mt-1">{allPets.length}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 p-3 rounded-full text-white"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  <Cat size={24} />
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            </button>
            <button type="button" onClick={() => navigate('employees', 'dashboard')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between text-left transition hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Employees</p>
                <p className="text-3xl font-bold mt-1">{allEmployees.length}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 p-3 rounded-full text-white"
                  style={{ backgroundColor: '#10b981' }}
                >
                  <Briefcase size={24} />
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            </button>
            <button type="button" onClick={() => navigate('schedule', 'dashboard')} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between text-left transition hover:shadow-md hover:border-amber-200 dark:hover:border-amber-700">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Scheduled</p>
                <p className="text-3xl font-bold mt-1">{schedules.length}</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 p-3 rounded-full text-white"
                  style={{ backgroundColor: '#f59e0b' }}
                >
                  <Calendar size={24} />
                </div>
                <ChevronRight className="text-gray-400" size={20} />
              </div>
            </button>
          </div>
        </div>
    </div>
  );
};

export default PetStoreDashboard;
