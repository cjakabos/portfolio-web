package com.udacity.jwdnd.course1.cloudinterface.entity;

public class Credential {
    private Integer credentialId;
    private String credentialUrl;
    private String credentialUsername;
    private String credentialPassword;
    private String credentialKey;
    private Integer credentialUserId;

    public Credential(){
    }
    public Credential(Integer credentialId, String url, String username, String key, String password, Integer userId) {
        this.credentialId = credentialId;
        this.credentialUrl = url;
        this.credentialUsername = username;
        this.credentialPassword = password;
        this.credentialKey = key;
        this.credentialUserId = userId;
    }

    public Integer getCredentialId() {
        return credentialId;
    }

    public void setCredentialId(Integer credentialId) {
        this.credentialId = credentialId;
    }

    public String getUrl() {
        return credentialUrl;
    }

    public void setUrl(String url) {
        this.credentialUrl = url;
    }

    public String getUsername() {
        return credentialUsername;
    }

    public void setUsername(String username) {
        this.credentialUsername = username;
    }

    public String getPassword() {
        return credentialPassword;
    }

    public void setPassword(String password) {
        this.credentialPassword = password;
    }

    public String getKey() {
        return credentialKey;
    }

    public void setKey(String key) {
        this.credentialKey = key;
    }

    public Integer getUserId() {
        return credentialUserId;
    }

    public void setUserId(Integer userId) {
        this.credentialUserId = userId;
    }
}
