package com.udacity.jdnd.course3.petstore;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.pet.PetDTO;
import com.udacity.jdnd.course3.petstore.pet.PetType;
import com.udacity.jdnd.course3.petstore.schedule.ScheduleDTO;
import com.udacity.jdnd.course3.petstore.user.CustomerDTO;
import com.udacity.jdnd.course3.petstore.user.EmployeeDTO;
import com.udacity.jdnd.course3.petstore.user.EmployeeRequestDTO;
import com.udacity.jdnd.course3.petstore.user.EmployeeSkill;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the Petstore service against a real MySQL database.
 *
 * Covers: Customer CRUD, Pet CRUD, Employee CRUD, Schedule CRUD,
 *         relationship integrity (customer↔pet, schedule↔employee/pet).
 *
 * Run via docker-compose.test.yml:
 *   docker compose -f docker-compose.test.yml up --build test-petstore-integration
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class PetstoreIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // Track IDs across ordered tests
    private Long customerId;
    private Long petId;
    private Long employeeId;

    // =========================================================================
    // CUSTOMER CRUD
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("POST /petstore/user/customer — create customer")
    void createCustomer() throws Exception {
        CustomerDTO dto = new CustomerDTO();
        dto.setName("Alice Johnson");
        dto.setPhoneNumber("555-0101");
        dto.setNotes("Prefers morning appointments");

        MvcResult result = mockMvc.perform(post("/user/customer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alice Johnson"))
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn();

        CustomerDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(), CustomerDTO.class);
        customerId = response.getId();
    }

    @Test
    @Order(2)
    @DisplayName("GET /petstore/user/customer — list all customers")
    void getAllCustomers() throws Exception {
        mockMvc.perform(get("/user/customer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].name").value("Alice Johnson"));
    }



    // =========================================================================
    // PET CRUD
    // =========================================================================

    @Test
    @Order(10)
    @DisplayName("POST /petstore/pet — create pet linked to customer")
    void createPet() throws Exception {
        PetDTO dto = new PetDTO();
        dto.setType(PetType.DOG);
        dto.setName("Buddy");
        dto.setOwnerId(customerId);
        dto.setNotes("Golden Retriever, 3 years old");

        MvcResult result = mockMvc.perform(post("/pet")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Buddy"))
                .andExpect(jsonPath("$.type").value("DOG"))
                .andExpect(jsonPath("$.ownerId").value(customerId))
                .andReturn();

        PetDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(), PetDTO.class);
        petId = response.getId();
    }

    @Test
    @Order(11)
    @DisplayName("GET /petstore/pet/{id} — get pet by ID")
    void getPetById() throws Exception {
        mockMvc.perform(get("/pet/" + petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(petId))
                .andExpect(jsonPath("$.name").value("Buddy"));
    }

    @Test
    @Order(12)
    @DisplayName("GET /petstore/pet — list all pets")
    void getAllPets() throws Exception {
        mockMvc.perform(get("/pet"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(13)
    @DisplayName("GET /petstore/pet/owner/{ownerId} — get pets by owner")
    void getPetsByOwner() throws Exception {
        mockMvc.perform(get("/pet/owner/" + customerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Buddy"));
    }



    // =========================================================================
    // EMPLOYEE CRUD
    // =========================================================================

    @Test
    @Order(20)
    @DisplayName("POST /petstore/user/employee — create employee with skills")
    void createEmployee() throws Exception {
        EmployeeDTO dto = new EmployeeDTO();
        dto.setName("Dr. Smith");
        dto.setSkills(Set.of(EmployeeSkill.FEEDING, EmployeeSkill.WALKING, EmployeeSkill.PETTING));
        dto.setDaysAvailable(Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY));

        MvcResult result = mockMvc.perform(post("/user/employee")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Dr. Smith"))
                .andExpect(jsonPath("$.skills", hasSize(3)))
                .andReturn();

        EmployeeDTO response = objectMapper.readValue(
                result.getResponse().getContentAsString(), EmployeeDTO.class);
        employeeId = response.getId();
    }

    @Test
    @Order(21)
    @DisplayName("GET /petstore/user/employee/{id} — get employee by ID")
    void getEmployeeById() throws Exception {
        mockMvc.perform(get("/user/employee/" + employeeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(employeeId))
                .andExpect(jsonPath("$.name").value("Dr. Smith"));
    }

    @Test
    @Order(22)
    @DisplayName("PUT /petstore/user/employee/{id} — set employee availability")
    void setEmployeeAvailability() throws Exception {
        Set<DayOfWeek> newDays = Set.of(
                DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);

        mockMvc.perform(put("/user/employee/" + employeeId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newDays)))
                .andExpect(status().isOk());
    }

    @Test
    @Order(23)
    @DisplayName("POST /petstore/user/employee/availability — find available employees")
    void findEmployeesForService() throws Exception {
        EmployeeRequestDTO requestDTO = new EmployeeRequestDTO();
        requestDTO.setDate(LocalDate.of(2026, 2, 16)); // Monday
        requestDTO.setSkills(Set.of(EmployeeSkill.FEEDING, EmployeeSkill.WALKING));

        mockMvc.perform(post("/user/employee/availability")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    // =========================================================================
    // SCHEDULE CRUD
    // =========================================================================

    @Test
    @Order(30)
    @DisplayName("POST /petstore/schedule — create schedule entry")
    void createSchedule() throws Exception {
        ScheduleDTO dto = new ScheduleDTO();
        dto.setDate(LocalDate.of(2026, 3, 2)); // Monday
        dto.setEmployeeIds(List.of(employeeId));
        dto.setPetIds(List.of(petId));
        dto.setActivities(Set.of(EmployeeSkill.FEEDING, EmployeeSkill.WALKING));

        mockMvc.perform(post("/schedule")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.petIds", hasSize(1)))
                .andExpect(jsonPath("$.employeeIds", hasSize(1)));
    }

    @Test
    @Order(31)
    @DisplayName("GET /petstore/schedule — list all schedules")
    void getAllSchedules() throws Exception {
        mockMvc.perform(get("/schedule"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(32)
    @DisplayName("GET /petstore/schedule/pet/{petId} — get schedule by pet")
    void getScheduleByPet() throws Exception {
        mockMvc.perform(get("/schedule/pet/" + petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(33)
    @DisplayName("GET /petstore/schedule/employee/{employeeId} — get schedule by employee")
    void getScheduleByEmployee() throws Exception {
        mockMvc.perform(get("/schedule/employee/" + employeeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(34)
    @DisplayName("GET /petstore/schedule/customer/{customerId} — get schedule by customer")
    void getScheduleByCustomer() throws Exception {
        mockMvc.perform(get("/schedule/customer/" + customerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }
}
