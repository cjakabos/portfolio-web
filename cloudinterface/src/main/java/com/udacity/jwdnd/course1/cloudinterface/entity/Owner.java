package com.udacity.jwdnd.course1.cloudinterface.entity;

public class Owner {
    private Integer ownerId;
    private String ownerPhoneNumber;
    private String ownerName;
    private Integer userId;

    public Owner() {
    }

    public Owner(Integer ownerId, String ownerPhoneNumber, String ownerName, Integer userId) {
        this.ownerId = ownerId;
        this.ownerPhoneNumber = ownerPhoneNumber;
        this.ownerName = ownerName;
        this.userId = userId;
    }


    public Integer getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Integer ownerId) {
        this.ownerId = ownerId;
    }

    public String getOwnerPhoneNumber() {
        return ownerPhoneNumber;
    }

    public void setOwnerPhoneNumber(String ownerPhoneNumber) {
        this.ownerPhoneNumber = ownerPhoneNumber;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }
}

