package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.udacity.jwdnd.course1.cloudinterface.entity.*;
import com.udacity.jwdnd.course1.cloudinterface.services.*;
import com.udacity.jwdnd.course1.cloudinterface.controller.CarController;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping()
public class HomeController {
    private CredentialService cService;
    private UserService uService;
    private FileService fService;
	private NoteService nService;
    private EncryptionService eService;
    private PetController pController;

    public HomeController(NoteService nService,
                          UserService uService,
                          CredentialService cService,
                          FileService fService,
                          EncryptionService eService,
                          PetController pController) {
        this.cService = cService;
        this.uService = uService;
        this.fService = fService;
        this.nService = nService;
        this.eService = eService;
        this.pController = pController;
    }


    @GetMapping("/home")
    public String getHome(Authentication authentication,
                          @ModelAttribute("newNote") Note note,
                          @ModelAttribute("newCredential") Credential credential,
                          @ModelAttribute("newCar") Car car,
                          @ModelAttribute("newPet") Pet pet,
                          @ModelAttribute("newOwner") Owner owner,
                          @ModelAttribute("newEmployee") Employee employee,
                          @ModelAttribute("newEcommerceUser") UserEcommerce newEcommerceUser,
                          @ModelAttribute("newEcommerceOrder") OrderEcommerce newEcommerceOrder,
                          Model model) throws Exception {
        Integer userId = uService.getUserId(authentication);

        model.addAttribute("filesList", fService.getFilesListByUserId(userId));
        model.addAttribute("notes", nService.getNotesByUserId(userId));
        model.addAttribute("credentials", cService.getCredentialsByUserId(userId));
		model.addAttribute("cars", CarController.getListCars());
		model.addAttribute("pets", PetController.getListPets());
        model.addAttribute("owners", PetController.getListOwners());
        model.addAttribute("employees", PetController.getListEmployees());
        model.addAttribute("encryptService", eService);
        model.addAttribute("encryptService", eService);
        model.addAttribute("skills", pController.getEmployeeSkillsList());
        return "home";
    }
}