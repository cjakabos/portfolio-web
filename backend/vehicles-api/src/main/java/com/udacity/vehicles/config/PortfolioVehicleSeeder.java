package com.udacity.vehicles.config;

import com.udacity.vehicles.domain.Condition;
import com.udacity.vehicles.domain.Location;
import com.udacity.vehicles.domain.car.Car;
import com.udacity.vehicles.domain.car.CarRepository;
import com.udacity.vehicles.domain.car.Details;
import com.udacity.vehicles.domain.manufacturer.Manufacturer;
import com.udacity.vehicles.domain.manufacturer.ManufacturerRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PortfolioVehicleSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PortfolioVehicleSeeder.class);

    private final CarRepository carRepository;
    private final ManufacturerRepository manufacturerRepository;
    private final boolean enabled;

    public PortfolioVehicleSeeder(
            CarRepository carRepository,
            ManufacturerRepository manufacturerRepository,
            @Value("${vehicles.seed.portfolio.data.enabled:false}") boolean enabled
    ) {
        this.carRepository = carRepository;
        this.manufacturerRepository = manufacturerRepository;
        this.enabled = enabled;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }

        if (carRepository.count() > 0) {
            log.info("Portfolio vehicle seeding skipped because vehicle data already exists");
            return;
        }

        Manufacturer audi = requireManufacturer(100, "Audi");
        Manufacturer bmw = requireManufacturer(103, "BMW");
        Manufacturer ford = requireManufacturer(102, "Ford");

        carRepository.saveAll(List.of(
                buildVehicle(
                        audi,
                        "A6 Avant",
                        "wagon",
                        "Graphite",
                        Condition.USED,
                        59.334591,
                        18.063240,
                        "Hybrid",
                        "2.0 TFSI e",
                        4,
                        48200,
                        2023,
                        2022
                ),
                buildVehicle(
                        bmw,
                        "i4",
                        "coupe",
                        "Arctic White",
                        Condition.NEW,
                        59.327460,
                        18.067991,
                        "Electric",
                        "Dual Motor",
                        4,
                        1200,
                        2025,
                        2024
                ),
                buildVehicle(
                        ford,
                        "Kuga",
                        "suv",
                        "Deep Blue",
                        Condition.USED,
                        59.320150,
                        18.047840,
                        "Plug-in Hybrid",
                        "2.5 Duratec",
                        4,
                        36500,
                        2022,
                        2021
                )
        ));

        log.info("Seeded portfolio vehicle baseline for the OpenMaps showcase");
    }

    private Manufacturer requireManufacturer(Integer code, String name) {
        return manufacturerRepository.findById(code)
                .orElseGet(() -> manufacturerRepository.save(new Manufacturer(code, name)));
    }

    private Car buildVehicle(
            Manufacturer manufacturer,
            String model,
            String body,
            String color,
            Condition condition,
            double lat,
            double lon,
            String fuelType,
            String engine,
            int doors,
            int mileage,
            int modelYear,
            int productionYear
    ) {
        Details details = new Details();
        details.setBody(body);
        details.setModel(model);
        details.setManufacturer(manufacturer);
        details.setExternalColor(color);
        details.setFuelType(fuelType);
        details.setEngine(engine);
        details.setNumberOfDoors(doors);
        details.setMileage(mileage);
        details.setModelYear(modelYear);
        details.setProductionYear(productionYear);

        Car car = new Car();
        car.setCondition(condition);
        car.setDetails(details);
        car.setLocation(new Location(lat, lon));
        return car;
    }
}
