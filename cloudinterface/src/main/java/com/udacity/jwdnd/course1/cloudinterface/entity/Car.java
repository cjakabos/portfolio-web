package com.udacity.jwdnd.course1.cloudinterface.entity;

public class Car {
    private Integer carId;
    private String carModel;
    private String carCondition;
    private Integer userId;
    private Integer carProductionYear;

    public Car() {
    }

    public Car(Integer carId, String carModel, String carCondition, Integer userId, Integer carProductionYear) {
        this.carId = carId;
        this.carModel = carModel;
        this.carCondition = carCondition;
        this.userId = userId;
        this.carProductionYear = carProductionYear;
    }


    public Integer getCarId() {
        return carId;
    }

    public void setCarId(Integer carId) {
        this.carId = carId;
    }

    public String getCarModel() {
        return carModel;
    }

    public void setCarModel(String carModel) {
        this.carModel = carModel;
    }

    public String getCarCondition() {
        return carCondition;
    }

    public void setCarCondition(String carCondition) {
        this.carCondition = carCondition;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public Integer getCarProductionYear() {
        return carProductionYear;
    }

    public void setCarProductionYear(Integer carProductionYear) {
        this.carProductionYear = carProductionYear;
    }
}
