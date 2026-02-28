import React, { useState } from 'react';
import { Skill } from '../../types';
import { Calendar, CheckCircle, Users } from 'lucide-react';
import PetStoreLayout from '../PetStoreLayout';
import { useSchedules } from '../../hooks/useSchedules';
import { useEmployees } from '../../hooks/useEmployees';
import { usePets } from '../../hooks/usePets';

const SKILL_OPTIONS: Skill[] = [
  Skill.PETTING,
  Skill.WALKING,
  Skill.FEEDING,
  Skill.MEDICATING,
  Skill.SHAVING,
];

const Schedules: React.FC = () => {
  const {
    availableEmployees,
    schedules,
    scheduleSubmit,
    getAvailability
  } = useSchedules();

  const { allEmployees } = useEmployees();
  const { allPets } = usePets();

  const [date, setDate] = useState('');
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<Skill[]>([]);
  //const [availableEmployees, setAvailableEmployees] = useState<typeof allEmployees>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPet, setSelectedPet] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const handleSkillToggle = (skill: Skill) => {
    setSelectedMultiOptions(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleFetchAvailability = async () => {
    if (!date || selectedMultiOptions.length === 0) return;

    setLoadingAvailability(true);

    try {
      await getAvailability(new Date(date), selectedMultiOptions);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedEmployee || !selectedPet || !date) return;

    await scheduleSubmit(
      selectedEmployee,
      selectedPet,
      new Date(date),
      selectedMultiOptions
    );

    // reset only what makes sense
    setSelectedEmployee('');
    setSelectedPet('');
    //setAvailableEmployees([]);
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: CREATE / FILTER */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar size={20} />
            New Schedule
          </h3>

          <input
            type="date"
            className="w-full border p-2 dark:bg-gray-700 rounded"
            value={date}
            onChange={e => setDate(e.target.value)}
          />

          {/* SKILLS */}
          <div>
            <p className="font-semibold mb-2">Required skills</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-1 rounded text-sm border transition ${
                    selectedMultiOptions.includes(skill)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          {/* PET */}
          <select
            className="w-full border p-2 dark:bg-gray-700 rounded"
            value={selectedPet}
            onChange={e => setSelectedPet(e.target.value)}
          >
            <option value="">Select Pet</option>
            {allPets.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleFetchAvailability}
            disabled={!date || selectedMultiOptions.length === 0}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:bg-gray-400"
          >
            {loadingAvailability ? 'Checking availability...' : 'Get available employees'}
          </button>
        </div>

        {/* MIDDLE: AVAILABLE EMPLOYEES */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={20} />
            Available Employees
          </h3>
            <div className="space-y-2">
              {availableEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp.id)}
                  className={`w-full text-left p-3 rounded border transition ${
                    selectedEmployee === emp.id
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <p className="font-semibold">{emp.name}</p>
                  <p className="text-xs text-gray-500">
                    Skills: {emp.skills.join(', ')}
                  </p>
                </button>
              ))}
            </div>

          <button
            onClick={handleCreateSchedule}
            disabled={!selectedEmployee || !selectedPet}
            className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:bg-gray-400"
          >
            Confirm Schedule
          </button>
        </div>

        {/* RIGHT: EXISTING SCHEDULES */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
          <h2 className="text-2xl font-bold mb-4">Activities</h2>

          {schedules.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No schedules yet
            </p>
          ) : (
            <div className="divide-y">
              {schedules.map(sch => {
                const pet = allPets.find(p => sch.petIds.includes(p.id));
                const employee = allEmployees.find(e =>
                  sch.employeeIds.includes(e.id)
                );

                const scheduleDate =
                  typeof sch.date === 'string'
                    ? sch.date
                    : new Date(sch.date).toLocaleDateString();

                return (
                  <div
                    key={sch.id}
                    className="py-4 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold">
                        {pet?.name || 'Unknown Pet'}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        with {employee?.name || 'Unknown Employee'} on{' '}
                        {scheduleDate}
                      </p>

                      {sch.activities?.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {sch.activities.map((activity, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded"
                            >
                              {activity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <CheckCircle className="text-green-500" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Schedules;
