package com.udacity.jdnd.course3.petstore.user;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.repository.*;
import com.udacity.jdnd.course3.petstore.user.*;
import com.udacity.jdnd.course3.petstore.service.*;

import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles web requests related to Users.
 * <p>
 * Includes requests for both customers and employees. Splitting this into separate user and customer controllers
 * would be fine too, though that is not part of the required scope for this class.
 */
@CrossOrigin(origins = {
        "http://localhost:5001",
        "https://localhost:5001",
        "http://localhost:5006",
        "https://localhost:5006",
        "http://localhost:80",
        "https://localhost:80"
})
@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private CustomerService customerService;

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private PetService petService;

    @Autowired
    private PetRepository petRepository;

    @PostMapping("/customer")
    public CustomerDTO saveCustomer(@RequestBody CustomerDTO customerDTO) {
        Customer customer = new Customer();
        customer.setName(customerDTO.getName());
        customer.setPhoneNumber(customerDTO.getPhoneNumber());
        customer.setNotes(customerDTO.getNotes());
        List<Long> petIds = customerDTO.getPetIds();

        List<Pet> pets = new ArrayList<>();
        if (petIds != null && !petIds.isEmpty()) {
            pets = petIds.stream().map((petId) -> petRepository.getOne(petId)).collect(Collectors.toList());
        }
        customer.setPets(pets);
        return getCustomerDTO(
                customerService.saveCustomer(
                        customer));
    }

    @GetMapping("/customer")
    public List<CustomerDTO> getAllCustomers() {
        return customerService.getCustomerDTOList()
                .stream()
                .map(this::getCustomerDTO)
                .collect(Collectors.toList());
    }

    @DeleteMapping("/customer/{customerId}")
    public void deleteCustomer(@PathVariable long customerId) {
        customerService.deleteCustomer(customerId);
    }

    @GetMapping("/employee")
    public List<EmployeeDTO> getAllEmployees() {
        return employeeService.getEmployeeDTOList()
                .stream()
                .map(this::getEmployeeDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/customer/pet/{petId}")
    public CustomerDTO getOwnerByPet(@PathVariable long petId) {
        Pet pet = petService.getPet(petId);
        return getCustomerDTO(customerService.getCustomerById(pet.getCustomer().getId()));
    }

    @PostMapping("/employee")
    public EmployeeDTO saveEmployee(@RequestBody EmployeeDTO employeeDTO) {
        Employee employee = new Employee();
        BeanUtils.copyProperties(employeeDTO, employee);
        employee.setSkills(employeeDTO.getSkills());
        employee.setDaysAvailable(employeeDTO.getDaysAvailable());

        return getEmployeeDTO(employeeService.saveEmployee(employee)
        );
    }

    @PostMapping("/employee/{employeeId}")
    public EmployeeDTO getEmployee(@PathVariable long employeeId) {
        return getEmployeeDTO(
                employeeService.getEmployeeById(employeeId)
        );
    }

    @PutMapping("/employee/{employeeId}")
    public void setAvailability(@RequestBody Set<DayOfWeek> daysAvailable, @PathVariable long employeeId) {
        //System.out.println(daysAvailable);
        employeeService.setEmployeeAvailability(daysAvailable, employeeId);
    }

    @PostMapping("/employee/availability")
    public List<EmployeeDTO> findEmployeesForService(@RequestBody EmployeeRequestDTO employeeDTO) {
        List<Employee> employeeAvailability = employeeService.findEmployeesForService(employeeDTO.getSkills(), employeeDTO.getDate().getDayOfWeek());
        return employeeAvailability.stream().map(this::getEmployeeDTO).collect(Collectors.toList());
    }

    @DeleteMapping("/employee/{employeeId}")
    public void deleteEmployee(@PathVariable long employeeId) {
        employeeService.deleteEmployee(employeeId);
    }

    private CustomerDTO getCustomerDTO(Customer customer) {
        CustomerDTO customerDTO = new CustomerDTO();
        customerDTO.setId(customer.getId());
        customerDTO.setName(customer.getName());
        customerDTO.setPhoneNumber(customer.getPhoneNumber());
        customerDTO.setNotes(customer.getNotes());
        List<Long> petIds = customer.getPets().stream().map(Pet::getId).collect(Collectors.toList());
        customerDTO.setPetIds(petIds);

        return customerDTO;
    }

    private EmployeeDTO getEmployeeDTO(Employee employee) {
        EmployeeDTO employeeDTO = new EmployeeDTO();
        employeeDTO.setId(employee.getId());
        employeeDTO.setName(employee.getName());
        employeeDTO.setDaysAvailable(employee.getDaysAvailable());
        employeeDTO.setSkills(employee.getSkills());

        return employeeDTO;
    }
}
