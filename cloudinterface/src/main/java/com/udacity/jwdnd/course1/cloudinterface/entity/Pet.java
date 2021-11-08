package com.udacity.jwdnd.course1.cloudinterface.entity;

public class Pet {
    private Integer petId;
    private String petModel;
    private String petCondition;
    private Integer userId;

    public Pet() {
    }

    public Pet(Integer petId, String petModel, String petCondition, Integer userId) {
        this.petId = petId;
        this.petModel = petModel;
        this.petCondition = petCondition;
        this.userId = userId;
    }


    public Integer getPetId() {
        return petId;
    }

    public void setPetId(Integer petId) {
        this.petId = petId;
    }

    public String getPetModel() {
        return petModel;
    }

    public void setPetModel(String petModel) {
        this.petModel = petModel;
    }

    public String getPetCondition() {
        return petCondition;
    }

    public void setPetCondition(String petCondition) {
        this.petCondition = petCondition;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }
}
