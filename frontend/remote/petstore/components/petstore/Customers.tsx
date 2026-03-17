import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/compat/router';
import { Plus, User, Phone } from 'lucide-react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useCustomers } from '../../hooks/useCustomers';
import { trackPetStoreEvent } from '../../lib/analytics';

interface CustomerRow {
  id: string;
  name: string;
  phoneNumber: string;
}

const columnHelper = createColumnHelper<CustomerRow>();

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
    const didCreateCustomer = await handleCustomerSubmit(e);
    if (didCreateCustomer) {
      trackPetStoreEvent('petstore_customer_create');
    }
    setShowForm(false);
  };

  const customerRows = useMemo<CustomerRow[]>(
    () =>
      allCustomers
        .filter((c) => Boolean(c?.id || c?.name || c?.phoneNumber))
        .map((c, index) => ({
          id: c.id || `customer-${index + 1}`,
          name: c.name || 'Unnamed customer',
          phoneNumber: c.phoneNumber || 'N/A',
        })),
    [allCustomers]
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <User size={16} />
            </div>
            <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
          </div>
        ),
      }),
      columnHelper.accessor('phoneNumber', {
        header: 'Phone',
        cell: ({ getValue }) => (
          <span className="text-gray-500 dark:text-gray-300">
            <Phone size={14} className="inline mr-2" />
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('id', {
        header: 'ID',
        cell: ({ getValue }) => (
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{getValue()}</span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: customerRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex min-h-[44px] items-center gap-2 hover:bg-indigo-700 transition"
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
                  className="px-4 py-2 border rounded-lg min-h-[44px] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg min-h-[44px] hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : customerRows.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-8 text-center text-gray-500 dark:text-gray-400">
            No customers found.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="px-6 py-4 text-xs font-semibold uppercase">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {table.getRowModel().rows.map((row) => (
                <div key={`mobile-${row.id}`} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <User size={16} />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{row.original.name}</p>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Phone</span>
                    <span className="text-gray-700 dark:text-gray-200 break-all text-right">{row.original.phoneNumber}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">ID</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all text-right">{row.original.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetStoreCustomers;
