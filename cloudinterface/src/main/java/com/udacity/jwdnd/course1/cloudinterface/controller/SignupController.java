package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.udacity.jwdnd.course1.cloudinterface.entity.CreateUserRequest;
import com.udacity.jwdnd.course1.cloudinterface.entity.User;
import com.udacity.jwdnd.course1.cloudinterface.services.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

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
    // Allow React CORS connection from localhost:5001
    @CrossOrigin(origins = "http://localhost:5001")
    @PostMapping("/api")
    public ResponseEntity<User> createUser(@RequestBody CreateUserRequest createUserRequest) {
        User user = new User();

        if (uService.isUsernameAvailable(createUserRequest.getUsername())) {

            user.setUsername(createUserRequest.getUsername());
            user.setPassword(createUserRequest.getPassword());
            user.setFirstname(createUserRequest.getFirstName());
            user.setLastname(createUserRequest.getLastname());

            uService.createUser(user);
        }

        return ResponseEntity.ok(user);
    }
}
