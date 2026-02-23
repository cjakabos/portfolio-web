package com.example.demo.utilities;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Collection;
import java.util.Date;
import java.util.List;

@Component
public class JwtUtilities {

    private static final Logger logger = LoggerFactory.getLogger(JwtUtilities.class);

    @Autowired
    public UserRepository userRepository;

    // -------------------------------------------------------------------------
    // Key paths are provided by configuration (environment variables in prod,
    // classpath test keys in test profile).
    //
    // Supports two formats:
    //   "classpath:some-key.pem"   → loaded from src/main/resources (or test/resources)
    //   "localhost+3-key.pem"      → loaded from the filesystem (relative to WORKDIR)
    //   "/absolute/path/key.pem"   → loaded from the filesystem (absolute)
    //
    // -------------------------------------------------------------------------
    @Value("${jwt.private-key-path}")
    private String privateKeyPath;

    @Value("${jwt.public-key-path}")
    private String publicKeyPath;

    @Value("${jwt.expiration.ms}")
    private long jwtExpirationMs;

    private static final String PEM_PUBLIC_START = "-----BEGIN PUBLIC KEY-----";
    private static final String PEM_PUBLIC_END = "-----END PUBLIC KEY-----";
    private static final String PEM_PRIVATE_START = "-----BEGIN PRIVATE KEY-----";
    private static final String PEM_PRIVATE_END = "-----END PRIVATE KEY-----";

    private RSAPrivateKey cachedPrivateKey;
    private RSAPublicKey cachedPublicKey;

    @PostConstruct
    void loadKeys() {
        try {
            cachedPrivateKey = loadPrivateKey();
            cachedPublicKey = loadPublicKey();
            logger.info("JWT keys loaded successfully (private={}, public={})", privateKeyPath, publicKeyPath);
        } catch (Exception e) {
            logger.error("Failed to load JWT keys on startup: {}", e.getMessage());
            throw new IllegalStateException("Cannot start without valid JWT keys", e);
        }
    }

    public String generateToken(Authentication auth) {
        Collection<? extends GrantedAuthority> authorities = auth.getAuthorities();
        List<String> roles = authorities == null ? List.of() : authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority != null && !authority.isBlank())
                .distinct()
                .toList();

        return JWT.create()
                .withIssuer("cloudapp")
                .withSubject(((org.springframework.security.core.userdetails.User) auth.getPrincipal()).getUsername())
                .withClaim("roles", roles)
                .withExpiresAt(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .sign(Algorithm.RSA512(cachedPrivateKey));
    }

    public String getSubject(String token) {
        try {
            return verifyToken(token).getSubject();
        } catch (JWTVerificationException exception) {
            logger.error("JWT verification failed: {}", exception.getMessage());
            throw new IllegalArgumentException("Invalid JWT token", exception);
        }
    }

    public List<String> getRoles(String token) {
        try {
            List<String> roles = verifyToken(token).getClaim("roles").asList(String.class);
            return roles == null ? List.of() : roles;
        } catch (JWTVerificationException exception) {
            logger.error("JWT verification failed: {}", exception.getMessage());
            throw new IllegalArgumentException("Invalid JWT token", exception);
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private DecodedJWT verifyToken(String token) {
        Algorithm algorithm = Algorithm.RSA512(cachedPublicKey);
        return JWT.require(algorithm)
                .withIssuer("cloudapp")
                .build()
                .verify(token);
    }

    private byte[] readKeyBytes(String path) throws IOException {
        if (path.startsWith("classpath:")) {
            String resource = path.substring("classpath:".length());
            try (InputStream is = new ClassPathResource(resource).getInputStream()) {
                return is.readAllBytes();
            }
        }
        return Files.readAllBytes(Paths.get(path));
    }

    private RSAPrivateKey loadPrivateKey() {
        try {
            String pem = new String(readKeyBytes(privateKeyPath));
            pem = pem.replace(PEM_PRIVATE_START, "").replace(PEM_PRIVATE_END, "");
            pem = pem.replaceAll("\\s", "");
            byte[] encoded = Base64.getDecoder().decode(pem);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(encoded);
            return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
        } catch (NoSuchAlgorithmException | InvalidKeySpecException | IOException e) {
            throw new IllegalArgumentException("Failed to load private key from: " + privateKeyPath, e);
        }
    }

    private RSAPublicKey loadPublicKey() {
        try {
            String pem = new String(readKeyBytes(publicKeyPath));
            pem = pem.replace(PEM_PUBLIC_START, "").replace(PEM_PUBLIC_END, "");
            pem = pem.replaceAll("\\s", "");
            byte[] encoded = Base64.getDecoder().decode(pem);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(encoded);
            return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (NoSuchAlgorithmException | InvalidKeySpecException | IOException e) {
            throw new IllegalArgumentException("Failed to load public key from: " + publicKeyPath, e);
        }
    }
}
