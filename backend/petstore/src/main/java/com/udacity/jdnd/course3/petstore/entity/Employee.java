package com.udacity.jdnd.course3.petstore.entity;

import com.udacity.jdnd.course3.petstore.user.EmployeeSkill;
import org.hibernate.annotations.Nationalized;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;


@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@Table(name = "employee")
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Nationalized
    private String name;

    @Nationalized
    @ElementCollection
    @Enumerated
    @CollectionTable(name = "employee_skills", joinColumns = @JoinColumn(name = "employee_id"), indexes = {
            @Index(name = "idx_employee_skills_employee_id", columnList = "employee_id"),
            @Index(name = "idx_employee_skills_skill", columnList = "skills")
    })
    @Column(name = "skills")
    private Set<EmployeeSkill> skills;

    @Nationalized
    @ElementCollection
    @Enumerated
    @CollectionTable(name = "employee_days_available", joinColumns = @JoinColumn(name = "employee_id"), indexes = {
            @Index(name = "idx_employee_days_employee_id", columnList = "employee_id"),
            @Index(name = "idx_employee_days_available", columnList = "days_available")
    })
    @Column(name = "days_available")
    private Set<DayOfWeek> daysAvailable;

    @Nationalized
    @ManyToMany(fetch = FetchType.LAZY, mappedBy = "employeeList")
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

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (!(obj instanceof Employee other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
