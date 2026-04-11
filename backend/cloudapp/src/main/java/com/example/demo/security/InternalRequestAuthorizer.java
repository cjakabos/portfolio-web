package com.example.demo.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;

@Component
public class InternalRequestAuthorizer {

    static final String INTERNAL_SERVICE_NAME_HEADER = "X-Internal-Service-Name";
    static final String INTERNAL_SERVICE_TOKEN_HEADER = "X-Internal-Service-Token";
    static final String GATEWAY_ADMIN_PROXY = "gateway-admin-proxy";
    static final String AI_ORCHESTRATION = "ai-orchestration";
    static final String SCOPE_CLOUDAPP_ADMIN_PROXY = "cloudapp.admin.proxy";
    static final String SCOPE_CLOUDAPP_APP = "cloudapp.app";

    @Value("${INTERNAL_GATEWAY_ADMIN_TOKEN:}")
    private String internalGatewayAdminToken;

    @Value("${INTERNAL_AI_ORCHESTRATION_TOKEN:}")
    private String internalAiOrchestrationToken;

    public Optional<InternalServiceIdentity> resolveIdentity(HttpServletRequest request) {
        if (request == null) {
            return Optional.empty();
        }

        String serviceName = normalize(request.getHeader(INTERNAL_SERVICE_NAME_HEADER));
        String token = request.getHeader(INTERNAL_SERVICE_TOKEN_HEADER);
        if (serviceName == null || token == null || token.isBlank()) {
            return Optional.empty();
        }

        if (GATEWAY_ADMIN_PROXY.equals(serviceName)
                && token.equals(internalGatewayAdminToken)
                && internalGatewayAdminToken != null
                && !internalGatewayAdminToken.isBlank()) {
            return Optional.of(new InternalServiceIdentity(
                    serviceName,
                    Set.of(SCOPE_CLOUDAPP_ADMIN_PROXY)
            ));
        }

        if (AI_ORCHESTRATION.equals(serviceName)
                && token.equals(internalAiOrchestrationToken)
                && internalAiOrchestrationToken != null
                && !internalAiOrchestrationToken.isBlank()) {
            return Optional.of(new InternalServiceIdentity(
                    serviceName,
                    Set.of(SCOPE_CLOUDAPP_APP)
            ));
        }

        return Optional.empty();
    }

    public boolean isInternalRequest(HttpServletRequest request) {
        return resolveIdentity(request).isPresent();
    }

    public boolean hasScope(HttpServletRequest request, String scope) {
        return resolveIdentity(request)
                .map(identity -> identity.hasScope(scope))
                .orElse(false);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
