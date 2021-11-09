package com.udacity.jwdnd.course1.cloudinterface.entity;

import java.util.List;

public class Employee {
    private Integer employeeId;
    private List<String> employeeSkills;
    private String employeeName;
    private Integer userId;

    public Employee() {
    }

    public Employee(Integer employeeId, List<String> employeeSkills, String employeeName, Integer userId) {
        this.employeeId = employeeId;
        this.employeeSkills = employeeSkills;
        this.employeeName = employeeName;
        this.userId = userId;
    }


    public Integer getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Integer employeeId) {
        this.employeeId = employeeId;
    }

    public List<String> getEmployeeSkills() {
        return employeeSkills;
    }

    public void setEmployeeType(List<String> employeeSkills) {
        this.employeeSkills = employeeSkills;
    }

    public String getEmployeeName() {
        return employeeName;
    }

    public void setEmployeeName(String employeeName) {
        this.employeeName = employeeName;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }
}

