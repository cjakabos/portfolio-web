package com.example.demo.security;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public record InternalServiceIdentity(String serviceName, Set<String> scopes) {

    public InternalServiceIdentity {
        scopes = Collections.unmodifiableSet(new HashSet<>(scopes));
    }

    public boolean hasScope(String scope) {
        return scopes.contains(scope);
    }
}
