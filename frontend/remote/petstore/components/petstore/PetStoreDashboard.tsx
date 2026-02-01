import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Cat, Calendar, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PetStoreLayout from '../PetStoreLayout';
import { useCustomers } from '../../hooks/useCustomers';
import { usePets } from '../../hooks/usePets';
import { useEmployees } from '../../hooks/useEmployees';
import { useSchedules } from '../../hooks/useSchedules';

const PetStoreDashboard: React.FC = () => {
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
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
              <h3 className="text-lg font-bold mb-4">Pets by Type</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={petData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {petData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/petstore/customers?action=new" className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 text-center">
                  Add Customer
                </Link>
                <Link href="/pets?action=new" className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-100 text-center">
                  Check In Pet
                </Link>
                <Link href="/petstore/schedule" className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-100 text-center">
                  New Schedule
                </Link>
                <Link href="/petstore/employees" className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-100 text-center">
                  Staff Availability
                </Link>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default PetStoreDashboard;