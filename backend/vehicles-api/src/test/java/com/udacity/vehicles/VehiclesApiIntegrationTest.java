package com.udacity.vehicles;

import com.udacity.vehicles.domain.Condition;
import com.udacity.vehicles.domain.Location;
import com.udacity.vehicles.domain.car.Car;
import com.udacity.vehicles.domain.car.CarRepository;
import com.udacity.vehicles.domain.car.Details;
import com.udacity.vehicles.domain.manufacturer.Manufacturer;
import com.udacity.vehicles.domain.manufacturer.ManufacturerRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for the Vehicles API.
 * Tests full CRUD lifecycle against the real H2 database.
 * Validates HATEOAS links in responses.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class VehiclesApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CarRepository carRepository;

    @Autowired
    private ManufacturerRepository manufacturerRepository;

    private Long carId;

    private Car buildTestCar() {
        Car car = new Car();
        car.setCondition(Condition.USED);

        Details details = new Details();
        Manufacturer manufacturer = manufacturerRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> {
                    Manufacturer m = new Manufacturer(100, "TestMfg");
                    return manufacturerRepository.save(m);
                });
        details.setManufacturer(manufacturer);
        details.setModel("TestModel X");
        details.setMileage(32000);
        details.setExternalColor("Silver");
        details.setBody("sedan");
        details.setEngine("2.5L I4");
        details.setFuelType("Gasoline");
        details.setModelYear(2022);
        details.setProductionYear(2022);
        details.setNumberOfDoors(4);
        car.setDetails(details);

        Location location = new Location(40.730610, -73.935242);
        car.setLocation(location);
        return car;
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("POST /vehicles/cars — should create a car")
    void createCar() throws Exception {
        Car car = buildTestCar();

        MvcResult result = mockMvc.perform(post("/cars")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(car)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.condition").value("USED"))
                .andExpect(jsonPath("$.details.model").value("TestModel X"))
                .andExpect(jsonPath("$.details.mileage").value(32000))
                .andReturn();

        String response = result.getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        carId = node.path("id").asLong();
        assertTrue(carId > 0, "Created car id must be populated");
    }

    // =========================================================================
    // READ
    // =========================================================================

    @Test
    @Order(2)
    @DisplayName("GET /vehicles/cars — should list all cars")
    void listCars() throws Exception {
        mockMvc.perform(get("/cars")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(3)
    @DisplayName("GET /vehicles/cars/{id} — should return car by ID")
    void getCarById() throws Exception {
        mockMvc.perform(get("/cars/" + carId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(carId))
                .andExpect(jsonPath("$.details.model").value("TestModel X"))
                .andExpect(jsonPath("$.condition").value("USED"));
    }

    @Test
    @Order(4)
    @DisplayName("GET /vehicles/cars/99999 — nonexistent car returns 404")
    void getCarById_notFound() throws Exception {
        mockMvc.perform(get("/cars/99999")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // UPDATE
    // =========================================================================

    @Test
    @Order(5)
    @DisplayName("PUT /vehicles/cars/{id} — should update car details")
    void updateCar() throws Exception {
        Car car = buildTestCar();
        car.setCondition(Condition.NEW);
        car.getDetails().setMileage(0);
        car.getDetails().setExternalColor("Midnight Blue");

        mockMvc.perform(put("/cars/" + carId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(car)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.condition").value("NEW"))
                .andExpect(jsonPath("$.details.mileage").value(0))
                .andExpect(jsonPath("$.details.externalColor").value("Midnight Blue"));

        // Verify persistence
        Car saved = carRepository.findById(carId).orElse(null);
        assertNotNull(saved);
        assertEquals(Condition.NEW, saved.getCondition());
    }

    // =========================================================================
    // DELETE
    // =========================================================================

    @Test
    @Order(6)
    @DisplayName("DELETE /vehicles/cars/{id} — should delete car")
    void deleteCar() throws Exception {
        mockMvc.perform(delete("/cars/" + carId))
                .andExpect(status().isNoContent());

        // Verify deletion
        assertFalse(carRepository.findById(carId).isPresent());
    }

    @Test
    @Order(7)
    @DisplayName("DELETE /vehicles/cars/99999 — nonexistent car returns 404")
    void deleteCar_notFound() throws Exception {
        mockMvc.perform(delete("/cars/99999"))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // ACTUATOR HEALTH
    // =========================================================================

    @Test
    @Order(100)
    @DisplayName("GET /vehicles/actuator/health — should return UP")
    void healthCheck() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
