package com.udacity.jwdnd.course1.cloudinterface.page;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.*;

public class LoginPage {

    @FindBy(css = "#inputUsername")
    private WebElement uField;

    @FindBy(css = "#inputPassword")
    private WebElement pField;

    @FindBy(css = "#loginButton")
    private WebElement lButton;

    public LoginPage(WebDriver webDriver) {
        PageFactory.initElements(webDriver, this);
    }

    public void login(String username, String password) {
        this.uField.sendKeys(username);
        this.pField.sendKeys(password);
        this.lButton.click();
    }
}
