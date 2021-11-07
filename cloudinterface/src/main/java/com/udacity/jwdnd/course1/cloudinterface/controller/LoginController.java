package com.udacity.jwdnd.course1.cloudinterface.controller;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Controller
@RequestMapping("/login")
public class LoginController {
    @GetMapping
    public String getLoginPage() {
        return "login";
    }
}
