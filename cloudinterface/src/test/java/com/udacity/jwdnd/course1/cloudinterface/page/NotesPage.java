package com.udacity.jwdnd.course1.cloudinterface.page;

import org.junit.jupiter.api.Assertions;
import org.openqa.selenium.*;
import org.openqa.selenium.support.*;
import org.openqa.selenium.support.ui.*;

public class NotesPage {
    private WebDriverWait wait;

    @FindBy(css = "#nav-notes-tab")
    public WebElement notesTab;

    @FindBy(css = "#showNoteForm")
    private WebElement showNote;

    @FindBy(css = "#note-title")
    public WebElement noteTitle;

    @FindBy(css = "#note-description")
    public WebElement noteDescription;

    @FindBy(css = "#noteSubmit")
    private WebElement noteSubmitButton;

    @FindBy(css = "note-title-text")
    private WebElement noteTitleText;

    @FindBy(css = "note-description-text")
    private WebElement noteDescriptionText;

    public NotesPage(WebDriver driver) {
        PageFactory.initElements(driver, this);
    }


    public void addNote(String noteTitleInput, String noteDescriptionInput, WebDriver driver) throws InterruptedException {
        this.wait = new WebDriverWait(driver, 1);

        wait.until(ExpectedConditions.elementToBeClickable(notesTab));
        notesTab.click();

        wait.until(ExpectedConditions.elementToBeClickable(showNote));
        Assertions.assertNotNull(showNote);
        showNote.click();

        wait.until(ExpectedConditions.visibilityOf(noteTitle));
        noteTitle.sendKeys(noteTitleInput);
        noteDescription.sendKeys(noteDescriptionInput);
        noteSubmitButton.submit();
    }


    public void editNote(int noteId, String noteTitleInput, String noteDescriptionInput, WebDriver driver) throws InterruptedException {
        notesTab.click();
        WebDriverWait wait = new WebDriverWait(driver, 1);
        String noteTableRef;
        noteTableRef = "//*[@id='userTable']/tbody[" + noteId + "]/tr/td[1]/button";
        WebElement element = driver.findElement(By.xpath(noteTableRef));
        wait.until(ExpectedConditions.elementToBeClickable(element));
        element.click();

        wait.until(ExpectedConditions.visibilityOf(noteTitle));
        noteTitle.clear();
        noteDescription.clear();
        noteTitle.sendKeys(noteTitleInput);
        noteDescription.sendKeys(noteDescriptionInput);

        wait.until(ExpectedConditions.visibilityOf(noteTitle));
        noteSubmitButton.submit();
    }

    public void deleteNote(int noteId, WebDriver driver) {
        notesTab.click();
        WebDriverWait wait = new WebDriverWait(driver, 1);
        String noteTableRef;
        noteTableRef = "//*[@id='userTable']/tbody[" + noteId + "]/tr/td[1]/a";
        WebElement element = driver.findElement(By.xpath(noteTableRef));
        wait.until(ExpectedConditions.elementToBeClickable(element));
        element.click();
    }

}
