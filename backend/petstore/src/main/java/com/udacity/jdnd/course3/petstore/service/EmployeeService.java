package com.udacity.jdnd.course3.petstore.service;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.user.*;
import com.udacity.jdnd.course3.petstore.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;
import java.util.stream.*;

@Service
public class EmployeeService {
    @Autowired
    EmployeeRepository employeeRepository;

    @Autowired
    ScheduleRepository scheduleRepository;

    public List<Employee> getEmployeeDTOList() {
        return employeeRepository.findAll();
    }

    public Employee saveEmployee(Employee employee) {
        return employeeRepository.save(employee);
    }

    public void deleteEmployee(Long employeeId) {
        employeeRepository.deleteById(employeeId);
    }

    public Employee getEmployeeById(long employeeId) {
        return employeeRepository.getOne(employeeId);
    }

    public void setEmployeeAvailability(Set<DayOfWeek> daysAvailable, long employeeId) {
        Employee employee = employeeRepository.getOne(employeeId);
        employee.setDaysAvailable(daysAvailable);
        employeeRepository.save(employee);
    }

    public List<Employee> findEmployeesForService(Set<EmployeeSkill> skills, DayOfWeek dayAvailable) {
        List<Employee> employeeList = employeeRepository.getAllBySkillsInAndDaysAvailableContains(skills, dayAvailable);

        return employeeList.stream().filter(employee -> employee.getSkills().containsAll(skills))
                .collect(Collectors.toList());
    }

    public List<Employee> getEmployeesBySchedule(Long scheduleId) {
        Schedule schedule = scheduleRepository.getOne(scheduleId);
        return schedule.getEmployeeList();
    }
}
