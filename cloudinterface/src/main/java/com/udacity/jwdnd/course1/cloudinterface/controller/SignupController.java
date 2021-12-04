package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.udacity.jwdnd.course1.cloudinterface.entity.User;
import com.udacity.jwdnd.course1.cloudinterface.services.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/signup")
public class SignupController {
    private UserService uService;

    public SignupController(UserService uService) {
        this.uService = uService;
    }

    @GetMapping()
    public String signupView() {
        return "signup";
    }

    @PostMapping
    private String signupUser(@ModelAttribute User user, Model model) {
        String feedbackType = null;

        if (!uService.isUsernameAvailable(user.getUsername())) {
            feedbackType = "The username already exist";
        } else {
            int userAdded = uService.createUser(user);
            if (userAdded < 0) {
                feedbackType = "There was error in the signup.";
            }
        }

        if (feedbackType == null) {
            feedbackType = "Successful signup";
            model.addAttribute("updateSuccess", feedbackType);
            return "signup";
        } else {
            model.addAttribute("updateError", feedbackType);
            return "signup";
        }
    }
}
