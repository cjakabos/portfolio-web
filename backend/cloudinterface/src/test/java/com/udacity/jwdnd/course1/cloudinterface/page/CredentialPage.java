package com.udacity.jwdnd.course1.cloudinterface.page;

import org.openqa.selenium.*;
import org.openqa.selenium.support.*;
import org.openqa.selenium.support.ui.*;

public class CredentialPage {

    private WebDriverWait wait;

    @FindBy(css = "#nav-credentials-tab")
    public WebElement credTab;

    @FindBy(css = "#showCredentialForm")
    private WebElement showCredForm;

    @FindBy(css = "#credential-url")
    private WebElement credUrl;

    @FindBy(css = "#credential-username")
    private WebElement credUsername;

    @FindBy(css = "#credential-password")
    public WebElement credPWD;

    @FindBy(css = "#credentialSubmit")
    private WebElement credSubmitButton;

    @FindBy(css = "#closeButton")
    public WebElement closeButton;

    public CredentialPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
        wait = new WebDriverWait(driver, 1);
    }

    public void addCredential(String url, String username, String password, WebDriver driver) throws InterruptedException {
        credTab.click();
        wait.until(ExpectedConditions.elementToBeClickable(showCredForm));
        showCredForm.click();

        wait.until(ExpectedConditions.visibilityOf(credUrl));
        credUrl.sendKeys(url);
        credUsername.sendKeys(username);
        credPWD.sendKeys(password);

        credSubmitButton.submit();
    }

    public void openCredential(int elementId, WebDriver driver) {
        credTab.click();
        String credTableRef;
        credTableRef = "//*[@id='credentialTable']/tbody[" + elementId + "]/tr/td[1]/button";
        WebElement element = driver.findElement(By.xpath(credTableRef));
        wait.until(ExpectedConditions.elementToBeClickable(element));
        element.click();
    }

    public void editCredential(int elementId, String url, String username, String password, WebDriver driver) {
        credTab.click();
        String credTableRef;
        credTableRef = "//*[@id='credentialTable']/tbody[" + elementId + "]/tr/td[1]/button";
        //*[@id="credentialTable"]/tbody[1]/tr/td[1]/button
        WebElement element = driver.findElement(By.xpath(credTableRef));
        wait.until(ExpectedConditions.elementToBeClickable(element));
        element.click();

        wait.until(ExpectedConditions.visibilityOf(credUrl));
        credUrl.clear();
        credUsername.clear();
        credPWD.clear();

        credUrl.sendKeys(url);
        credUsername.sendKeys(username);
        credPWD.sendKeys(password);

        credSubmitButton.submit();
    }

    public void closeCredential(WebDriver driver) {
        wait.until(ExpectedConditions.visibilityOf(credUrl));
        closeButton.click();
    }

    public void deleteCredential(int elementId, WebDriver driver) {
        credTab.click();
        String credTableRef;
        credTableRef = "//*[@id='credentialTable']/tbody[" + elementId + "]/tr/td[1]/a";
        WebElement element = driver.findElement(By.xpath(credTableRef));
        wait.until(ExpectedConditions.elementToBeClickable(element));
        element.click();
    }
}
