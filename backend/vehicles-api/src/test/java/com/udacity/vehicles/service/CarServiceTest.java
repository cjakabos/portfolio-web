package com.udacity.vehicles.service;

import com.udacity.vehicles.client.maps.MapsClient;
import com.udacity.vehicles.client.prices.PriceClient;
import com.udacity.vehicles.domain.Location;
import com.udacity.vehicles.domain.car.Car;
import com.udacity.vehicles.domain.car.CarRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CarServiceTest {

    @Mock
    private CarRepository repository;

    @Mock
    private MapsClient mapsClient;

    @Mock
    private PriceClient priceClient;

    @InjectMocks
    private CarService carService;

    @Test
    void listReturnsEnrichedCars() {
        Car persistedCar = new Car();
        persistedCar.setId(1L);
        persistedCar.setLocation(new Location(40.730610, -73.935242));

        Car freshRepositoryCar = new Car();
        freshRepositoryCar.setId(1L);
        freshRepositoryCar.setLocation(new Location(40.730610, -73.935242));

        Location enrichedLocation = new Location(40.730610, -73.935242);
        enrichedLocation.setAddress("123 Main St");
        enrichedLocation.setCity("New York");
        enrichedLocation.setState("NY");
        enrichedLocation.setZip("10001");

        when(repository.findAll()).thenReturn(List.of(persistedCar), List.of(freshRepositoryCar));
        when(mapsClient.getAddress(any(Location.class))).thenReturn(enrichedLocation);
        when(priceClient.getPrice(1L)).thenReturn("USD 12345");

        List<Car> cars = carService.list();

        assertEquals(1, cars.size());
        assertNotNull(cars.get(0).getLocation());
        assertEquals("123 Main St", cars.get(0).getLocation().getAddress());
        assertEquals("USD 12345", cars.get(0).getPrice());
        verify(repository, times(1)).findAll();
        verify(mapsClient, times(1)).getAddress(any(Location.class));
        verify(priceClient, times(1)).getPrice(1L);
    }
}
