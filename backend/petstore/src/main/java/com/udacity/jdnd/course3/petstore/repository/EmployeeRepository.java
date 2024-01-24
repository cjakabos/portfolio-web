package com.udacity.jdnd.course3.petstore.repository;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.user.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.util.*;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> getAllBySkillsInAndDaysAvailableContains(Set<EmployeeSkill> skills, DayOfWeek daysAvailable);
}

