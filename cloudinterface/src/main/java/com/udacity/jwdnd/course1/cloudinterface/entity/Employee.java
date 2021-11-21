package com.udacity.jwdnd.course1.cloudinterface.entity;

import org.springframework.web.bind.annotation.ModelAttribute;

import java.util.ArrayList;
import java.util.List;

public class Employee {
    private Integer employeeId;
    private List<String> employeeSkills;
    private String employeeName;
    private Integer userId;
    private List<String> employeeSchedule;

    public Employee() {
    }

    public Employee(Integer employeeId, List<String> employeeSkills, String employeeName, Integer userId, List<String> employeeSchedule) {
        this.employeeId = employeeId;
        this.employeeSkills = employeeSkills;
        this.employeeName = employeeName;
        this.userId = userId;
        this.employeeSchedule = employeeSchedule;
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

    public void setEmployeeSkills(List<String> employeeSkills) {
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

    public List<String> getEmployeeSchedule() {
        return employeeSchedule;
    }

    public void setEmployeeSchedule(List<String> employeeSchedule) {
        this.employeeSchedule = employeeSchedule;
    }
}

