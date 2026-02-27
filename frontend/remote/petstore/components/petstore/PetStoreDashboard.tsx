import React, { useEffect, useState } from 'react';
import { Users, Cat, Calendar, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PetStoreLayout from '../PetStoreLayout';
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
            <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your pet store operations</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Customers</p>
                <p className="text-3xl font-bold mt-1">{allCustomers.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500 text-white"><Users size={24} /></div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Pets</p>
                <p className="text-3xl font-bold mt-1">{allPets.length}</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-500 text-white"><Cat size={24} /></div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Employees</p>
                <p className="text-3xl font-bold mt-1">{allEmployees.length}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500 text-white"><Briefcase size={24} /></div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">Scheduled</p>
                <p className="text-3xl font-bold mt-1">{schedules.length}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-500 text-white"><Calendar size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate('customers')} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center cursor-pointer">
                  Add Customer
                </button>
                <button onClick={() => navigate('pets')} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center cursor-pointer">
                  Check In Pet
                </button>
                <button onClick={() => navigate('schedule')} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center cursor-pointer">
                  New Schedule
                </button>
                <button onClick={() => navigate('employees')} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 text-center cursor-pointer">
                  Staff Availability
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default PetStoreDashboard;