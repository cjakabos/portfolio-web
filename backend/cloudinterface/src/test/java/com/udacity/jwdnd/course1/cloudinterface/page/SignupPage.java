package com.udacity.jwdnd.course1.cloudinterface.page;

import org.openqa.selenium.*;
import org.openqa.selenium.support.*;

public class SignupPage {
    @FindBy(css = "#inputUsername")
    private WebElement userField;

    @FindBy(css = "#inputPassword")
    private WebElement pwdField;

    @FindBy(css = "#inputFirstName")
    private WebElement fnField;

    @FindBy(css = "#inputLastName")
    private WebElement lnField;

    @FindBy(css = "#signupButton")
    private WebElement signupButton;

    public SignupPage(WebDriver webDriver) {
        PageFactory.initElements(webDriver, this);
    }

    public void signup(String firstname, String lastname, String username, String password) {
        this.userField.sendKeys(username);
        this.pwdField.sendKeys(password);
        this.fnField.sendKeys(firstname);
        this.lnField.sendKeys(lastname);
        this.signupButton.submit();
    }
}
