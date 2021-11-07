package com.udacity.jwdnd.course1.cloudinterface;

import com.udacity.jwdnd.course1.cloudinterface.entity.*;
import com.udacity.jwdnd.course1.cloudinterface.page.*;
import com.udacity.jwdnd.course1.cloudinterface.services.*;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.server.LocalServerPort;

import java.util.List;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CloudInterfaceApplicationTests {

    @LocalServerPort
    private int port;

    private String randomPort;

    private WebDriver driver;

    private SignupPage signupPage;

    private LoginPage loginPage;

    private FilePage filePage;

    private NotesPage notesPage;

    private CredentialPage credentialPage;

    private ResultPage resultPage;

    private String adminUser = "admin";

    private String adminPWD = "12345";

    private WebDriverWait wait;

    @Autowired
    private CredentialService credentialService;

    @Autowired
    private NoteService noteService;

    private EncryptionService encryptionService;

    public void adminUserLogin() throws InterruptedException {
        driver.get(randomPort + "/signup");
        signupPage.signup("John", "Doe", adminUser, adminPWD);
        driver.get(randomPort + "/login");
        loginPage.login(adminUser, adminPWD);
    }

    @BeforeAll
    static void beforeAll() {
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    public void beforeEach() throws InterruptedException {
        this.randomPort = "http://localhost:" + port;
        this.driver = new ChromeDriver();
        this.signupPage = new SignupPage(driver);
        this.loginPage = new LoginPage(driver);
        this.filePage = new FilePage(driver);
        this.notesPage = new NotesPage(driver);
        this.credentialPage = new CredentialPage(driver);
        this.resultPage = new ResultPage(driver);
        this.wait = new WebDriverWait(driver, 1);
    }

    @AfterEach
    public void afterEach() {
        if (this.driver != null) {
            driver.quit();
        }
    }

    @Test
    public void testLoginPage() {
        driver.get(randomPort + "/login");
        Assertions.assertEquals("Login", driver.getTitle());
    }

    @Test
    public void testSignupPage() {
        driver.get(randomPort + "/signup");
        Assertions.assertEquals("Sign Up", driver.getTitle());
    }
	
    //Write a test that verifies that an unauthorized user can only access
	//the login and signup pages.
    @Test
    public void testHomeUnauthorizedPageAccess() {
		driver.get(randomPort + "/login");
        Assertions.assertEquals("Login", driver.getTitle());
        driver.get(randomPort + "/signup");
        Assertions.assertEquals("Sign Up", driver.getTitle());
        driver.get(randomPort + "/home");
        Assertions.assertNotEquals("Home", driver.getTitle());
		Assertions.assertEquals("Login", driver.getTitle());
    }

    //Write a test that signs up a new user, logs in, verifies that the
	//home page is accessible, logs out, and verifies that the home page
	//is no longer accessible.
	@Test
    public void testNewUser() throws InterruptedException {
        driver.get(randomPort + "/signup");
        signupPage.signup("New", "User", "newUser", "12345");
        driver.get(randomPort + "/login");
        loginPage.login("newUser", "12345");
        Assertions.assertEquals("Home", driver.getTitle());
        filePage.clickLoggingOut();
        Assertions.assertEquals("Login", driver.getTitle());
        testHomeUnauthorizedPageAccess();
    }

	//Test of trying to upload empty file
    @Test
    public void testEmptyUpload() throws InterruptedException {
        adminUserLogin();
        wait.until(ExpectedConditions.elementToBeClickable(filePage.files));
        filePage.addFile();
        resultPage.clickErrorResult();
    }

    @Test
    public void testNote() throws InterruptedException {
        adminUserLogin();
        //Write a test that creates a note, and verifies it is displayed.
		String noteTitle = "Make a test note";
        String noteDescription = "If text is seen, we are good";
        NotesPage notesPage = new NotesPage(driver);
        int noteId = 1;
        notesPage.addNote(noteTitle, noteDescription, driver);

        wait.until(ExpectedConditions.elementToBeClickable(notesPage.notesTab));
        List<Note> noteList = noteService.getNotesByUserId(1);
        Assertions.assertEquals(noteTitle, noteList.get(noteId-1).getNoteTitle());
        Assertions.assertEquals(noteDescription, noteList.get(noteId-1).getNoteDescription());

        noteTitle = "Second note";
        noteDescription = "Looks like second";

        noteId = 2;
        notesPage.addNote(noteTitle, noteDescription, driver);

        //Write a test that edits an existing note and verifies that the changes
		//are displayed.
		wait.until(ExpectedConditions.elementToBeClickable(notesPage.notesTab));
        noteList = noteService.getNotesByUserId(1);
        Assertions.assertEquals(noteTitle, noteList.get(noteId-1).getNoteTitle());
        Assertions.assertEquals(noteDescription, noteList.get(noteId-1).getNoteDescription());

        noteTitle = "Modified note";
        noteDescription = "Looks even better now";
        wait.until(ExpectedConditions.elementToBeClickable(notesPage.notesTab));

        notesPage.editNote(noteId, noteTitle, noteDescription, driver);

        //Write a test that deletes a note and verifies that the note is no longer displayed.
		wait.until(ExpectedConditions.elementToBeClickable(notesPage.notesTab));
        noteList = noteService.getNotesByUserId(1);
        Assertions.assertEquals(noteTitle, noteList.get(noteId-1).getNoteTitle());
        Assertions.assertEquals(noteDescription, noteList.get(noteId-1).getNoteDescription());
        notesPage.deleteNote(noteId, driver);
    }

    @Test
    public void testCredentials() throws InterruptedException {
        adminUserLogin();
        //credentialPage.credTab.click();
        //Write a test that creates a set of credentials, verifies that they are displayed,
		//and verifies that the displayed password is encrypted.
		String url = "test1url";
        String user = "test1user";
        String pwd = "test1pwd";
        int userId = 1;

        credentialPage.addCredential(url, user, pwd, driver);

        List<Credential> credential = credentialService.getCredentialsByUserId(1);
        this.encryptionService = new EncryptionService();
        Assertions.assertNotEquals(credential.get(userId - 1).getPassword(), pwd);
        Assertions.assertEquals(this.encryptionService.decryptValue(credential.get(userId - 1).getPassword(), credential.get(userId - 1).getKey()), pwd);

        url = "test2url";
        user = "test2user";
        pwd = "test2pwd";
        userId = 2;

        wait.until(ExpectedConditions.elementToBeClickable(credentialPage.credTab));
        credentialPage.addCredential(url, user, pwd, driver);
        credential = credentialService.getCredentialsByUserId(1);

        //Write a test that views an existing set of credentials, verifies that the viewable
		//password is unencrypted, edits the credentials, and verifies that the changes are
		//displayed.
		wait.until(ExpectedConditions.elementToBeClickable(credentialPage.credTab));
        credentialPage.openCredential(userId, driver);

        wait.until(ExpectedConditions.elementToBeClickable(credentialPage.credTab));
        Assertions.assertEquals(pwd, credentialPage.credPWD.getAttribute("value"));
        credentialPage.closeCredential(driver);

        wait.until(ExpectedConditions.elementToBeClickable(credentialPage.credTab));
        pwd = "changed2pwd";
        credentialPage.editCredential(userId, url, user, pwd, driver);

        wait.until(ExpectedConditions.elementToBeClickable(credentialPage.credTab));
        credential = credentialService.getCredentialsByUserId(1);

        Assertions.assertEquals(pwd, this.encryptionService.decryptValue(credential.get(userId - 1).getPassword(), credential.get(userId - 1).getKey()));

        //Write a test that deletes an existing set of credentials and verifies that the
		//credentials are no longer displayed.
		userId = 1;
        credential = credentialService.getCredentialsByUserId(1);
        String userToDelete = credential.get(userId - 1).getUsername();
        Assertions.assertEquals(userToDelete, credential.get(userId - 1).getUsername());
        credentialPage.deleteCredential(userId, driver);
        credential = credentialService.getCredentialsByUserId(1);
        Assertions.assertNotEquals(userToDelete, credential.get(userId - 1).getUsername());
    }
}
