package com.example.demo.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class InternalRequestAuthorizer {

    private static final String INTERNAL_AUTH_HEADER = "X-Internal-Auth";

    @Value("${INTERNAL_SERVICE_TOKEN:}")
    private String internalServiceToken;

    public boolean isInternalRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        if (internalServiceToken == null || internalServiceToken.isBlank()) {
            return false;
        }
        String headerValue = request.getHeader(INTERNAL_AUTH_HEADER);
        return internalServiceToken.equals(headerValue);
    }
}
