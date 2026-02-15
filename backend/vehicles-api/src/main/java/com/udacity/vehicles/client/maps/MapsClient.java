package com.udacity.vehicles.client.maps;

import com.udacity.vehicles.domain.Location;

import java.util.Objects;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.modelmapper.ModelMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Implements a class to interface with the Maps Client for location data.
 *
 * Wrapped with Resilience4j @CircuitBreaker to prevent cascade failures
 * when the Maps service is down or slow. When the circuit is open, the
 * fallback returns the original location without an address — the car
 * data is still usable, just without street-level detail.
 */
@Component
public class MapsClient {

    private static final Logger log = LoggerFactory.getLogger(MapsClient.class);

    private final WebClient client;
    private final ModelMapper mapper;

    public MapsClient(WebClient maps,
                      ModelMapper mapper) {
        this.client = maps;
        this.mapper = mapper;
    }

    /**
     * Gets an address from the Maps client, given latitude and longitude.
     *
     * @param location An object containing "lat" and "lon" of location
     * @return An updated location including street, city, state and zip,
     * or the original location if the Maps service is unavailable
     */
    @CircuitBreaker(name = "mapsService", fallbackMethod = "getAddressFallback")
    public Location getAddress(Location location) {
        Address address = client
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/maps/")
                        .queryParam("lat", location.getLat())
                        .queryParam("lon", location.getLon())
                        .build()
                )
                .retrieve().bodyToMono(Address.class).block();

        mapper.map(Objects.requireNonNull(address), location);

        return location;
    }

    /**
     * Fallback method when the Maps service circuit breaker is open
     * or the call fails. Returns the location as-is (with lat/lon but
     * without street, city, state, zip).
     */
    private Location getAddressFallback(Location location, Throwable t) {
        log.warn("Maps service unavailable (circuit breaker fallback). Returning location without address. Reason: {}",
                t.getMessage());
        return location;
    }
}