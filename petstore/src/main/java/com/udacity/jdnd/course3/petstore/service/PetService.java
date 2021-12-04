package com.udacity.jdnd.course3.petstore.service;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PetService {
    @Autowired
    PetRepository petRepository;

    @Autowired
    ScheduleRepository scheduleRepository;

    @Autowired
    CustomerRepository customerRepository;


    public Pet savePet(Pet pet, long ownerId) {

        Customer customer = customerRepository.getOne(ownerId);
        pet.setCustomer(customer);
        pet = petRepository.save(pet);

        customer.addPet(pet);
        customerRepository.save(customer);

        return pet;
    }

    public Pet getPet(Long petId) {
        return petRepository.getOne(petId);
    }

    public void deletePet(Long petId) {
        petRepository.deleteById(petId);
    }

    public List<Pet> getPetsByOwnerId(long customerId) {
        return petRepository.getPetsByCustomerId(customerId);
    }

    public List<Pet> getPetsBySchedule(Long scheduleId) {
        Schedule schedule = scheduleRepository.getOne(scheduleId);

        return schedule.getPetList();
    }

    public List<Pet> getPets() {
        return petRepository.findAll();
    }
}
