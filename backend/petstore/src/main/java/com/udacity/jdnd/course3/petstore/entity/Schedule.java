package com.udacity.jdnd.course3.petstore.entity;

import com.udacity.jdnd.course3.petstore.user.EmployeeSkill;

import org.hibernate.annotations.Nationalized;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.*;

@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@Table(name = "schedule")
public class Schedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Nationalized
    private LocalDate date;

    @ManyToMany
    @JoinTable(name = "schedule_employee_list",
            joinColumns = @JoinColumn(name = "schedule_id"),
            inverseJoinColumns = @JoinColumn(name = "employee_list_id"),
            indexes = {
                    @Index(name = "idx_schedule_employee_schedule_id", columnList = "schedule_id"),
                    @Index(name = "idx_schedule_employee_employee_id", columnList = "employee_list_id")
            })
    private List<Employee> employeeList;

    @ManyToMany
    @JoinTable(name = "schedule_customer_list",
            joinColumns = @JoinColumn(name = "schedule_id"),
            inverseJoinColumns = @JoinColumn(name = "customer_list_id"),
            indexes = {
                    @Index(name = "idx_schedule_customer_schedule_id", columnList = "schedule_id"),
                    @Index(name = "idx_schedule_customer_customer_id", columnList = "customer_list_id")
            })
    private List<Customer> customerList;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "schedule_pet_list",
            joinColumns = @JoinColumn(name = "schedule_id"),
            inverseJoinColumns = @JoinColumn(name = "pet_list_id"),
            indexes = {
                    @Index(name = "idx_schedule_pet_schedule_id", columnList = "schedule_id"),
                    @Index(name = "idx_schedule_pet_pet_id", columnList = "pet_list_id")
            })
    private List<Pet> petList;

    @ElementCollection
    @Enumerated
    @CollectionTable(name = "schedule_employee_skills", joinColumns = @JoinColumn(name = "schedule_id"), indexes = {
            @Index(name = "idx_schedule_employee_skills_schedule_id", columnList = "schedule_id"),
            @Index(name = "idx_schedule_employee_skills_skill", columnList = "employee_skills")
    })
    @Column(name = "employee_skills")
    private Set<EmployeeSkill> employeeSkills;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public List<Employee> getEmployeeList() {
        return employeeList;
    }

    public void setEmployeeList(List<Employee> employeeList) {
        this.employeeList = employeeList;
    }

    public List<Customer> getCustomerList() {
        return customerList;
    }

    public void setCustomerList(List<Customer> customerList) {
        this.customerList = customerList;
    }

    public List<Pet> getPetList() {
        return petList;
    }

    public void setPetList(List<Pet> petList) {
        this.petList = petList;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Set<EmployeeSkill> getEmployeeSkills() {
        return employeeSkills;
    }

    public void setEmployeeSkills(Set<EmployeeSkill> employeeSkills) {
        this.employeeSkills = employeeSkills;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (!(obj instanceof Schedule other)) {
            return false;
        }
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
