package com.udacity.jdnd.course3.petstore.entity;

import com.udacity.jdnd.course3.petstore.pet.PetType;
import org.hibernate.annotations.Nationalized;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;

@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@Table(name = "pet", indexes = {
        @Index(name = "idx_pet_customer", columnList = "customer")
})
public class Pet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    @Nationalized
    @Column(name = "pet_type")
    private PetType petType;

    @Nationalized
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, targetEntity = Customer.class)
    @JoinColumn(name = "customer")
    private Customer customer;

    @Nationalized
    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Nationalized
    private String notes;

    @ManyToMany(mappedBy = "petList")
    private List<Schedule> schedules;

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public PetType getPetType() {
        return petType;
    }

    public void setPetType(PetType petType) {
        this.petType = petType;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
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
        if (!(obj instanceof Pet other)) {
            return false;
        }
        return id != 0L && id == other.id;
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
