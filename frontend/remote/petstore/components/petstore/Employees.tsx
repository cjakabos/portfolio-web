import React from 'react';
import { Skill, DayOfWeek } from '../../types';
import { Plus, Briefcase } from 'lucide-react';
import PetStoreLayout from '../PetStoreLayout';
import { useEmployees } from '../../hooks/useEmployees';

const Employees: React.FC = () => {
  const {
    allEmployees,
    loading,
    employee,
    selectedMultiOptions,
    selectedDayOption,
    handleEmployeeChange,
    handleEmployeeSubmit,
    handleMultiSelect,
    handleDaysMultiSelect,
  } = useEmployees();

  const [showForm, setShowForm] = React.useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    await handleEmployeeSubmit(e);
    setShowForm(false);
  };

  const handleSkillToggle = (skill: Skill) => {
    const options = selectedMultiOptions.includes(skill) 
      ? selectedMultiOptions.filter(s => s !== skill) 
      : [...selectedMultiOptions, skill];
    
    // Simulate event for handleMultiSelect
    const fakeEvent = {
      target: {
        options: Object.values(Skill).map(s => ({
          value: s,
          selected: options.includes(s)
        }))
      }
    };
    handleMultiSelect(fakeEvent as any);
  };

  const handleDayToggle = (day: DayOfWeek) => {
    const options = selectedDayOption.includes(day) 
      ? selectedDayOption.filter(d => d !== day) 
      : [...selectedDayOption, day];
    
    // Simulate event for handleDaysMultiSelect
    const fakeEvent = {
      target: {
        options: Object.values(DayOfWeek).map(d => ({
          value: d,
          selected: options.includes(d)
        }))
      }
    };
    handleDaysMultiSelect(fakeEvent as any);
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Employees</h2>
            <p className="text-gray-500">Manage staff and skills</p>
          </div>
          <button 
            onClick={() => setShowForm(true)} 
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition"
          >
            <Plus size={18} /> New Employee
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border">
            <h3 className="text-lg font-semibold mb-4">Add New Employee</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input 
                type="text" 
                name="name"
                className="w-full border rounded px-4 py-2 dark:bg-gray-700" 
                placeholder="Name" 
                value={employee.name} 
                onChange={handleEmployeeChange} 
                required 
              />
              
              <div>
                <label className="block text-sm font-medium mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(Skill).map(skill => (
                    <button 
                      key={skill} 
                      type="button" 
                      onClick={() => handleSkillToggle(skill)} 
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        selectedMultiOptions.includes(skill) 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Available Days</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(DayOfWeek).map(day => (
                    <button 
                      key={day} 
                      type="button" 
                      onClick={() => handleDayToggle(day)} 
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        selectedDayOption.includes(day) 
                          ? 'bg-blue-100 text-blue-800 border-blue-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {allEmployees.map(emp => (
              <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Briefcase size={24} />
                  </div>
                  <h3 className="font-bold">{emp.name}</h3>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {emp.skills.map(skill => (
                      <span key={skill} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {emp.daysAvailable && emp.daysAvailable.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">Available Days</p>
                    <div className="flex flex-wrap gap-1">
                      {emp.daysAvailable.map(day => (
                        <span key={day} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Employees;