package com.udacity.vehicles.client.prices;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Implements a class to interface with the Pricing Client for price data.
 *
 * Wrapped with Resilience4j @CircuitBreaker to prevent cascade failures
 * when the Pricing service is down or slow. When the circuit is open, the
 * fallback returns "(consult price)" so the car data is still returned
 * to the user — just without a price.
 */
@Component
public class PriceClient {

    private static final Logger log = LoggerFactory.getLogger(PriceClient.class);

    private final WebClient client;

    public PriceClient(WebClient pricing) {
        this.client = pricing;
    }

    /**
     * Gets a vehicle price from the pricing client, given vehicle ID.
     *
     * @param vehicleId ID number of the vehicle for which to get the price
     * @return Currency and price of the requested vehicle,
     * error message that the vehicle ID is invalid, or note that the
     * service is down.
     */
    @CircuitBreaker(name = "pricingService", fallbackMethod = "getPriceFallback")
    public String getPrice(Long vehicleId) {
        Price price = client
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("services/price/")
                        .queryParam("vehicleId", vehicleId)
                        .build()
                )
                .retrieve().bodyToMono(Price.class).block();

        return String.format("%s %s", price.getCurrency(), price.getPrice());
    }

    /**
     * Fallback method when the Pricing service circuit breaker is open
     * or the call fails. Returns a placeholder price string so the
     * car listing is still usable.
     */
    private String getPriceFallback(Long vehicleId, Throwable t) {
        log.warn("Pricing service unavailable for vehicle {} (circuit breaker fallback). Reason: {}",
                vehicleId, t.getMessage());
        return "(consult price)";
    }
}