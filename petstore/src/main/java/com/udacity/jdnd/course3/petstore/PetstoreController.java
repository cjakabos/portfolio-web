package com.udacity.jdnd.course3.petstore;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dummy controller class to verify installation success. Do not use for
 * your project work.
 */
@RestController
public class PetstoreController {

    @GetMapping("/test")
    public String test() {
        return "Petstore Starter installed successfully";
    }
}
