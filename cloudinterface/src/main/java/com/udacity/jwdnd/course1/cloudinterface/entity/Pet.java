package com.udacity.jwdnd.course1.cloudinterface.entity;

public class Pet {
    private Integer petId;
    private Integer petOwnerId;
    private String petType;
    private String petName;
    private Integer userId;

    public Pet() {
    }

    public Pet(Integer petId, String petType, String petName, Integer userId, Integer petOwnerId) {
        this.petId = petId;
        this.petOwnerId = petOwnerId;
        this.petType = petType;
        this.petName = petName;
        this.userId = userId;
    }


    public Integer getPetId() {
        return petId;
    }

    public void setPetId(Integer petId) {
        this.petId = petId;
    }

    public Integer getPetOwnerId() {
        return petOwnerId;
    }

    public void setPetOwnerId(Integer petOwnerId) {
        this.petOwnerId = petOwnerId;
    }

    public String getPetType() {
        return petType;
    }

    public void setPetType(String petType) {
        this.petType = petType;
    }

    public String getPetName() {
        return petName;
    }

    public void setPetName(String petName) {
        this.petName = petName;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }
}
