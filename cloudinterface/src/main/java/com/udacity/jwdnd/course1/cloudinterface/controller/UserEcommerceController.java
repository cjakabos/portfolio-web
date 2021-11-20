package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.entity.UserEcommerce;
import com.udacity.jwdnd.course1.cloudinterface.services.NoteService;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/ecommerce")
public class UserEcommerceController {
    private NoteService nService;

    public UserEcommerceController(NoteService nService) {
        this.nService = nService;
    }

    @PostMapping("/addUser")
    public String insertOrUpdateNote(Authentication authentication,
                                     @ModelAttribute("newEcommerceUser") UserEcommerce userEcommerce,
                                     Model model) {
        String userFeedback = "Success";
        System.out.println("This adds user");
        System.out.println(printString());


        String url = "http://localhost:8099/api/user/create";

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            System.out.println("parse try" + userEcommerce.getEcommerceUsername() + userEcommerce.getEcommercePassword());
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            System.out.println("parse ok");
            jsonObject.addProperty("username", userEcommerce.getEcommerceUsername());
            jsonObject.addProperty("password", userEcommerce.getEcommercePassword());
            jsonObject.addProperty("confirmPassword", userEcommerce.getEcommercePassword());
            System.out.println(jsonObject.toString());

                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
                StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

                request.addHeader("content-type", "application/json");
                request.setEntity(params);
                HttpResponse response = httpClient.execute(request);

                HttpEntity entity = response.getEntity();
                String responseString = EntityUtils.toString(entity, "UTF-8");
                jsonObject = JsonParser.parseString(responseString).getAsJsonObject();


                System.out.println("User is successsfully added");

            url = "http://localhost:8099/login";
            request = new HttpPost(url);
            jsonObject = JsonParser.parseString(printStringLogin()).getAsJsonObject();
            jsonObject.addProperty("username", userEcommerce.getEcommerceUsername());
            jsonObject.addProperty("password", userEcommerce.getEcommercePassword());
            System.out.println(jsonObject.toString());
            params = new StringEntity(jsonObject.toString(), "UTF-8");
            request.setEntity(params);
            response = httpClient.execute(request);

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/delete/{noteId}")
    public String deleteNote(@PathVariable Integer noteId,
                             Model model) {
        String userFeedback = "Success";
        nService.deleteNote(noteId);
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    public String printString() {
        String jsonString = "{\n" +
                "  \"username\": \"USED\",\n" +
                "  \"password\": \"USED\",\n" +
                "  \"confirmPassword\": \"USED\"\n" +
                "}";
        return jsonString;
    }

    public String printStringLogin() {
        String jsonString = "{\n" +
                "  \"username\": \"USED\",\n" +
                "  \"password\": \"USED\"\n" +
                "}";
        return jsonString;
    }
}
