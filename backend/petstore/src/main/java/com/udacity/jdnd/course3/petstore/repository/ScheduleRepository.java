package com.udacity.jdnd.course3.petstore.repository;

import com.udacity.jdnd.course3.petstore.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> getSchedulesByEmployeeListContains(Employee employee);

    List<Schedule> getSchedulesByPetListId(Long petId);
}
