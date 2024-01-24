package com.udacity.jdnd.course3.petstore.repository;

import com.udacity.jdnd.course3.petstore.entity.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
}
