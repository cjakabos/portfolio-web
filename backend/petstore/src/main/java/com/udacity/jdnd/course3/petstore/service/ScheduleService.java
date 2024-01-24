package com.udacity.jdnd.course3.petstore.service;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ScheduleService {
    @Autowired
    ScheduleRepository scheduleRepository;

    @Autowired
    EmployeeRepository employeeRepository;

    public Schedule createSchedule(Schedule schedule) {
        return scheduleRepository.save(schedule);
    }

    public void deleteSchedule(Long scheduleId) {
        scheduleRepository.deleteById(scheduleId);
    }

    public List<Schedule> getAllSchedules() {
        return scheduleRepository.findAll();
    }

    public List<Schedule> getScheduleForPet(long petId) {
        return scheduleRepository.getSchedulesByPetListId(petId);
    }

    public List<Schedule> getScheduleForEmployee(long employeeId) {
        Employee employee = employeeRepository.getOne(employeeId);
        return scheduleRepository.getSchedulesByEmployeeListContains(employee);
    }
}
