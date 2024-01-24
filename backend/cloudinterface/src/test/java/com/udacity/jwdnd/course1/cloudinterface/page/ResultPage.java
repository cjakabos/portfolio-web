package com.udacity.jwdnd.course1.cloudinterface.page;

import org.openqa.selenium.*;
import org.openqa.selenium.support.*;

public class ResultPage {
    @FindBy(css = "#errorResult1")
    private WebElement errorResult;

    public ResultPage(WebDriver webDriver) {
        PageFactory.initElements(webDriver, this);
    }

    public void clickErrorResult() throws InterruptedException {
        errorResult.click();
    }
}
