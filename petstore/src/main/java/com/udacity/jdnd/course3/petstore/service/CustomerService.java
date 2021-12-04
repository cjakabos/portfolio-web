package com.udacity.jdnd.course3.petstore.service;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class CustomerService {
    @Autowired
    CustomerRepository customerRepository;

    public Customer saveCustomer(Customer customer) {
        return customerRepository.save(customer);
    }

    public List<Customer> getCustomerDTOList() {
        return customerRepository.findAll();
    }

    public Customer getCustomerById(long customerId) {
        return customerRepository.getOne(customerId);
    }

    public void deleteCustomer(long customerId) {
        customerRepository.deleteById(customerId);
    }
}
