package com.udacity.jdnd.course3.petstore.schedule;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Handles web requests related to Schedules.
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
@RequestMapping("/schedule")
public class ScheduleController {

    private ScheduleService scheduleService;
    private EmployeeService employeeService;
    private PetService petService;
    private CustomerService customerService;

    public ScheduleController(PetService petService, CustomerService customerService,
                              EmployeeService employeeService, ScheduleService scheduleService) {
        this.petService = petService;
        this.customerService = customerService;
        this.employeeService = employeeService;
        this.scheduleService = scheduleService;
    }

    @PostMapping
    public ScheduleDTO createSchedule(@RequestBody ScheduleDTO scheduleDTO) {
        Schedule schedule = new Schedule();
        schedule.setDate(scheduleDTO.getDate());
        schedule.setEmployeeSkills(scheduleDTO.getActivities());

        List<Employee> employees = scheduleDTO.getEmployeeIds().stream()
                .map((employeeId) -> employeeService.getEmployeeById(employeeId))
                .collect(Collectors.toList());
        schedule.setEmployeeList(employees);

        List<Pet> pets = scheduleDTO.getPetIds().stream()
                .map((petId) -> petService.getPet(petId))
                .collect(Collectors.toList());
        schedule.setPetList(pets);

        return getScheduleDTO(scheduleService.createSchedule(schedule));

    }

    @DeleteMapping("/{scheduleId}")
    public void deleteSchedule(@PathVariable Long scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
    }

    @GetMapping
    public List<ScheduleDTO> getAllSchedules() {
        List<Schedule> schedules = scheduleService.getAllSchedules();
        return schedules.stream()
                .map(this::getScheduleDTO).collect(Collectors.toList());
    }

    @GetMapping("/pet/{petId}")
    public List<ScheduleDTO> getScheduleForPet(@PathVariable long petId) {
        List<Schedule> schedules = scheduleService.getScheduleForPet(petId);
        return schedules.stream()
                .map(this::getScheduleDTO).collect(Collectors.toList());
    }

    @GetMapping("/employee/{employeeId}")
    public List<ScheduleDTO> getScheduleForEmployee(@PathVariable long employeeId) {
        List<Schedule> schedules = scheduleService.getScheduleForEmployee(employeeId);
        return schedules.stream().map(this::getScheduleDTO).collect(Collectors.toList());

    }

    @GetMapping("/customer/{customerId}")
    public List<ScheduleDTO> getScheduleForCustomer(@PathVariable long customerId) {
        List<ScheduleDTO> scheduleDTOS = new ArrayList<>();
        Customer customer = customerService.getCustomerById(customerId);
        List<Pet> pets = customer.getPets();

        List<Schedule> schedules = pets.stream()
                .flatMap(pet -> scheduleService.getScheduleForPet(pet.getId()).stream())
                .collect(Collectors.toList());
        scheduleDTOS = schedules.stream().map(this::getScheduleDTO).collect(Collectors.toList());
        return scheduleDTOS;
    }

    private ScheduleDTO getScheduleDTO(Schedule schedule) {
        ScheduleDTO scheduleDTO = new ScheduleDTO();
        scheduleDTO.setId(schedule.getId());
        scheduleDTO.setDate(schedule.getDate());

        scheduleDTO.setActivities(schedule.getEmployeeSkills());

        scheduleDTO.setPetIds(petService.getPetsBySchedule(
                        schedule.getId())
                .stream()
                .map(Pet::getId)
                .collect(Collectors.toList()));

        scheduleDTO.setEmployeeIds(
                employeeService.getEmployeesBySchedule(
                                schedule.getId())
                        .stream().map(Employee::getId)
                        .collect(Collectors.toList()));

        return scheduleDTO;
    }
}
