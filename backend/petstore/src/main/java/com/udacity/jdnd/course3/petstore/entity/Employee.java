package com.udacity.jdnd.course3.petstore.entity;

import com.udacity.jdnd.course3.petstore.user.EmployeeSkill;
import org.hibernate.annotations.Nationalized;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;


@Entity
@Inheritance(strategy = InheritanceType.JOINED)
public class Employee {
    @Id
    @GeneratedValue
    private Long id;

    @Nationalized
    private String name;

    @Nationalized
    @ElementCollection
    @Enumerated
    private Set<EmployeeSkill> skills;

    @Nationalized
    @ElementCollection
    @Enumerated
    private Set<DayOfWeek> daysAvailable;

    @Nationalized
    @ManyToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY, mappedBy = "employeeList")
    private List<Schedule> schedules;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Set<EmployeeSkill> getSkills() {
        return skills;
    }

    public void setSkills(Set<EmployeeSkill> skills) {
        this.skills = skills;
    }

    public Set<DayOfWeek> getDaysAvailable() {
        return daysAvailable;
    }

    public void setDaysAvailable(Set<DayOfWeek> daysAvailable) {
        this.daysAvailable = daysAvailable;
    }

    public List<Schedule> getSchedules() {
        return schedules;
    }

    public void setSchedules(List<Schedule> schedules) {
        this.schedules = schedules;
    }
}
