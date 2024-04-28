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
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.KeyFactory;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Date;

@Component
public class JwtUtilities {

    private static final Logger logger = LoggerFactory.getLogger(JwtUtilities.class);

    @Autowired
    public UserRepository userRepository;

    private static final String PUBLIC_KEY_FILE_RSA = "localhost+3-key.pub";
    private static final String PRIVATE_KEY_FILE_RSA = "localhost+3-key.pem";

    private static final String PEM_PUBLIC_START = "-----BEGIN PUBLIC KEY-----";
    private static final String PEM_PUBLIC_END = "-----END PUBLIC KEY-----";

    private static final String PEM_PRIVATE_START = "-----BEGIN PRIVATE KEY-----";
    private static final String PEM_PRIVATE_END = "-----END PRIVATE KEY-----";

    public String generateToken(Authentication auth) {

        RSAPrivateKey key;

        try {
            String privateKeyPem = new String(Files.readAllBytes(Paths.get(PRIVATE_KEY_FILE_RSA)));
            privateKeyPem = privateKeyPem.replace(PEM_PRIVATE_START, "").replace(PEM_PRIVATE_END, "");
            privateKeyPem = privateKeyPem.replaceAll("\\s", "");
            byte[] pkcs8EncodedKey = Base64.getDecoder().decode(privateKeyPem);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(pkcs8EncodedKey);
            key = (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
        } catch (NoSuchAlgorithmException | InvalidKeySpecException | IOException e) {
            throw new IllegalArgumentException(e);
        }

        return JWT.create()
                .withIssuer("cloudapp")
                .withSubject(((org.springframework.security.core.userdetails.User) auth.getPrincipal()).getUsername())
                .withExpiresAt(new Date(System.currentTimeMillis() + 864_000_000))
                .sign(Algorithm.RSA512(key));
    }

    public String getSubject(String token) {

        RSAPublicKey key;
        try {
            String publicKeyPem = new String(Files.readAllBytes(Paths.get(PUBLIC_KEY_FILE_RSA)));
            publicKeyPem = publicKeyPem.replace(PEM_PUBLIC_START, "").replace(PEM_PUBLIC_END, "");
            publicKeyPem = publicKeyPem.replaceAll("\\s", "");
            X509EncodedKeySpec data = new X509EncodedKeySpec(Base64.getDecoder().decode((publicKeyPem)));
            key = (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(data);
        } catch (NoSuchAlgorithmException | InvalidKeySpecException | IOException e) {
            throw new IllegalArgumentException(e);
        }

        DecodedJWT verifier = null;
        try {
            Algorithm algorithm = Algorithm.RSA512(key);
            verifier = JWT.require(algorithm)
                    .withIssuer("cloudapp")
                    .build()
                    .verify(token);
            verifier.getSubject();
        } catch (JWTVerificationException exception) {
            System.out.println(exception.toString());
        }

        return verifier.getSubject();
    }
}

