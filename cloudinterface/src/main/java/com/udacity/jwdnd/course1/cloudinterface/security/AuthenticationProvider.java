package com.udacity.jwdnd.course1.cloudinterface.security;

import com.udacity.jwdnd.course1.cloudinterface.entity.Credential;
import com.udacity.jwdnd.course1.cloudinterface.services.CredentialService;
import com.udacity.jwdnd.course1.cloudinterface.services.EncryptionService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/credential")
public class AuthenticationProvider {
    private CredentialService credentialService;

    public AuthenticationProvider(CredentialService credentialService, EncryptionService encryptionService) {
        this.credentialService = credentialService;
    }

    @PostMapping("/addCredential")
    public String insertOrUpdate(Authentication authentication,
                                 @ModelAttribute("newCredential") Credential credential,
                                 Model model) {
        String userFeedback = "Done";
        String username = authentication.getName();
        credentialService.addOrUpdateCredential(credential, username);

        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    @GetMapping("/delete/{credentialId}")
    public String deleteCredential(Authentication authentication,
                                   @PathVariable Integer credentialId,
                                   Model model) {
        String userFeedback = "Done";

        credentialService.deleteCredential(credentialId);

        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }
}
