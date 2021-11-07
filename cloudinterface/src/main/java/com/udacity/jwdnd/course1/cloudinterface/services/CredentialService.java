package com.udacity.jwdnd.course1.cloudinterface.services;

import com.udacity.jwdnd.course1.cloudinterface.entity.Credential;
import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.mappers.CredentialMapper;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.*;

@Service
public class CredentialService {
    private CredentialMapper credentialMapper;
    private UserService userService;
    private EncryptionService encryptionService;

    public CredentialService(CredentialMapper credentialMapper, UserService userService, EncryptionService encryptionService) {
        this.credentialMapper = credentialMapper;
        this.userService = userService;
        this.encryptionService = encryptionService;
    }

    public List<Credential> getCredentialsByUserId(Integer userId) {
        return credentialMapper.getCredentialByUserId(userId);
    }

    public boolean addOrUpdateCredential(Credential newCredential, String username) {
        Integer credentialId = newCredential.getCredentialId();

        SecureRandom random = new SecureRandom();
        byte[] key = new byte[16];
        random.nextBytes(key);
        String encodedKey = Base64.getEncoder().encodeToString(key);
        String encryptedPassword = encryptionService.encryptValue(newCredential.getPassword(), encodedKey);

        Credential credential = new Credential();
        credential.setKey(encodedKey);
        credential.setCredentialId(newCredential.getCredentialId());
        credential.setUrl(newCredential.getUrl());
        credential.setUsername(newCredential.getUsername());
        credential.setPassword(encryptedPassword);

        if (credentialId == null) {
            Integer userId = userService.getUserByUsername(username).getUserId();
            credential.setUserId(userId);
            credentialMapper.addCredential(credential);
        } else {
            credential.setUserId(newCredential.getUserId());
            credentialMapper.updateCredential(credential);
        }
        return true;
    }


    public boolean deleteCredential(Integer credentialId) {
        credentialMapper.deleteCredential(credentialId);
        return true;
    }
}
