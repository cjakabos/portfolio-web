package com.udacity.jwdnd.course1.cloudinterface.page;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;


public class FilePage {

    @FindBy(css = "#loggingOut")
    private WebElement loggingOut;

    @FindBy(css = "#nav-files")
    public WebElement files;

    @FindBy(css = "#fileSubmit")
    private WebElement fileSubmit;

    public FilePage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }

    public void clickLoggingOut() {
        loggingOut.click();
    }

    public void addFile() {
        files.click();
        fileSubmit.click();
    }
}
