package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.entity.OrderEcommerce;
import com.udacity.jwdnd.course1.cloudinterface.entity.UserEcommerce;
import com.udacity.jwdnd.course1.cloudinterface.services.NoteService;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.json.HTTP;
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

    private String bearerToken;

    public static String currentUser;

    public UserEcommerceController(NoteService nService) {
        this.nService = nService;
    }

    public static String getCurrentUser(){
        return currentUser;
    }
    @PostMapping("/addUser")
    public String addEcommerceUser(Authentication authentication,
                                   @ModelAttribute("newEcommerceUser") UserEcommerce userEcommerce,
                                   Model model) {
        currentUser = userEcommerce.getEcommerceUsername();

        String userFeedback;
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
            HttpResponse responseLogin = httpClient.execute(request);

            if (responseLogin.getStatusLine().getStatusCode() == 200) {
                Header[] headers = responseLogin.getAllHeaders();
                this.bearerToken = headers[0].toString().substring(15);
                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
            } else {
                userFeedback = "Error during login";
                model.addAttribute("updateError", userFeedback);
            }

        } catch (Exception ex) {
            userFeedback = "Ecommerce service is not available";
            model.addAttribute("updateError", userFeedback);
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }

        return "result";
    }

    @PostMapping("/addToOrder")
    public String addToEcommerceCart(Authentication authentication,
                                     @ModelAttribute("newEcommerceOrder") OrderEcommerce order,
                                     Model model) {
        String userFeedback = "Success";
        System.out.println("This adds order");


        String url = "http://localhost:8099/api/cart/addToCart";

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            System.out.println("parse try" + order.getEcommerceOrderUsername() + order.getEcommerceItemId() + order.getEcommerceQuantity());
            JsonObject jsonObject = JsonParser.parseString(printStringOrder()).getAsJsonObject();
            System.out.println("parse ok");
            jsonObject.addProperty("username", order.getEcommerceOrderUsername());
            jsonObject.addProperty("itemId", order.getEcommerceItemId());
            jsonObject.addProperty("quantity", order.getEcommerceQuantity());
            System.out.println(jsonObject.toString());

            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.setHeader("content-type", "application/json");
            request.setHeader("Authorization", this.bearerToken);
            request.setEntity(params);

            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            System.out.println("Order: " + jsonObject.toString());

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }
        return "result";
    }

    @PostMapping("/submitOrder")
    public String submitOrder(Authentication authentication,
                              Model model) {
        String userFeedback = "Success";
        System.out.println("This submits order");

        String url = "http://localhost:8099/api/order/submit/" + this.currentUser;

        System.out.println("url : " + url);

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            request.setHeader("content-type", "application/json");
            request.setHeader("Authorization", this.bearerToken);

            HttpResponse response = httpClient.execute(request);
            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            JsonObject jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            System.out.println("Order: " + jsonObject.toString());
            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            
        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }

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

    public String printStringOrder() {
        String jsonString = "{\n" +
                "  \"username\": \"USED\",\n" +
                "  \"itemId\": \"1\",\n" +
                "  \"quantity\": \"1\"\n" +
                "}";
        return jsonString;
    }
}
