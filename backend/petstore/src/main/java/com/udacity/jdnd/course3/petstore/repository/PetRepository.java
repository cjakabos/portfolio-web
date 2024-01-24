package com.udacity.jdnd.course3.petstore.repository;

import com.udacity.jdnd.course3.petstore.entity.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PetRepository extends JpaRepository<Pet, Long> {
    List<Pet> getPetsByCustomerId(Long customerId);
}
