package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.*;
import com.google.gson.reflect.TypeToken;
import com.udacity.jwdnd.course1.cloudinterface.entity.Item;
import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.entity.OrderEcommerce;
import com.udacity.jwdnd.course1.cloudinterface.entity.UserEcommerce;
import com.udacity.jwdnd.course1.cloudinterface.services.NoteService;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.json.HTTP;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Type;
import java.util.*;

@Controller
@RequestMapping("/ecommerce")
public class UserEcommerceController {
    private NoteService nService;

    private static String bearerToken;

    public static String currentUser;

    public UserEcommerceController(NoteService nService) {
        this.nService = nService;
    }

    public static String getCurrentUser() {
        return currentUser;
    }

    @PostMapping("/addUser")
    public String addEcommerceUser(Authentication authentication,
                                   @ModelAttribute("newEcommerceUser") UserEcommerce userEcommerce,
                                   Model model) {
        currentUser = userEcommerce.getEcommerceUsername();

        String userFeedback;

        String url = "http://localhost:8099/api/user/create";

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            jsonObject.addProperty("username", userEcommerce.getEcommerceUsername());
            jsonObject.addProperty("password", userEcommerce.getEcommercePassword());
            jsonObject.addProperty("confirmPassword", userEcommerce.getEcommercePassword());

            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            url = "http://localhost:8099/login";
            request = new HttpPost(url);
            jsonObject = JsonParser.parseString(printStringLogin()).getAsJsonObject();
            jsonObject.addProperty("username", userEcommerce.getEcommerceUsername());
            jsonObject.addProperty("password", userEcommerce.getEcommercePassword());

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

    @PostMapping("/addItem")
    public String addEcommerceItem(Authentication authentication,
                                   @ModelAttribute("newEcommerceItem") Item item,
                                   Model model) {
        String itemFeedback;

        String url = "http://localhost:8099/api/item";

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            JsonObject jsonObject = JsonParser.parseString(printStringItem()).getAsJsonObject();
            jsonObject.addProperty("name", item.getName());
            jsonObject.addProperty("price", item.getPrice());
            jsonObject.addProperty("description", item.getDescription());

            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setHeader("Authorization", this.bearerToken);
            request.setEntity(params);
            HttpResponse response = httpClient.execute(request);

            if (response.getStatusLine().getStatusCode() == 200) {
                itemFeedback = "Success";
                model.addAttribute("updateSuccess", itemFeedback);
            } else {
                itemFeedback = "Error during item creation";
                model.addAttribute("updateError", itemFeedback);
            }

        } catch (Exception ex) {
            itemFeedback = "Ecommerce service is not available";
            model.addAttribute("updateError", itemFeedback);
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }

        return "result";
    }

    public static List<Map<String, String>> getListItems() throws Exception {
        List<Map<String, String>> items = new ArrayList<Map<String, String>>();
        Map<String, String> newItem = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8099/api/item";
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            request.setHeader("Authorization", bearerToken);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("name");
                String itemName = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("price");
                String itemPrice = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String itemId = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("description");
                String itemDescription = jsonElement.getAsString();

                newItem = new HashMap<String, String>() {
                    {
                        put("itemName", itemName);
                        put("itemId", itemId);
                        put("itemPrice", itemPrice);
                        put("itemDescription", itemDescription);
                    }
                };
                items.add(newItem);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }

        return items;
    }

    @PostMapping("/addToOrder")
    public String addToEcommerceCart(Authentication authentication,
                                     @ModelAttribute("newEcommerceOrder") OrderEcommerce order,
                                     Model model) {
        String userFeedback = "Success";

        String url = "http://localhost:8099/api/cart/addToCart";

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            JsonObject jsonObject = JsonParser.parseString(printStringOrder()).getAsJsonObject();
            jsonObject.addProperty("username", this.currentUser);
            jsonObject.addProperty("itemId", order.getEcommerceItemId());
            jsonObject.addProperty("quantity", order.getEcommerceQuantity());

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

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }
        return "result";
    }

    public static List<Map<String, String>> getCart() throws Exception {
        List<Map<String, String>> items = new ArrayList<Map<String, String>>();
        Map<String, String> newItem = new HashMap();

        String url = "http://localhost:8099/api/cart/getCart";

        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpPost request = new HttpPost(url);


            JsonObject jsonObject = JsonParser.parseString(printStringCartRequest()).getAsJsonObject();
            jsonObject.addProperty("username", currentUser);

            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);
            request.setHeader("Authorization", bearerToken);

            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonObject().get("items").getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("name");
                String itemName = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("price");
                String itemPrice = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String itemId = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("description");
                String itemDescription = jsonElement.getAsString();

                newItem = new HashMap<String, String>() {
                    {
                        put("itemName", itemName);
                        put("itemId", itemId);
                        put("itemPrice", itemPrice);
                        put("itemDescription", itemDescription);
                    }
                };
                items.add(newItem);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }

        return items;
    }

    @PostMapping("/clearCart")
    public static String clearCart(Model model) throws Exception {
        String url = "http://localhost:8099/api/cart/clearCart";

        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpPost request = new HttpPost(url);

            JsonObject jsonObject = JsonParser.parseString(printStringCartRequest()).getAsJsonObject();
            jsonObject.addProperty("username", currentUser);

            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);
            request.setHeader("Authorization", bearerToken);

            HttpResponse response = httpClient.execute(request);

            String userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);

        } catch (Exception e) {
            //  Block of code to handle errors
        }

        return "result";
    }

    @PostMapping("/submitOrder")
    public String submitOrder(Authentication authentication,
                              Model model) {
        String userFeedback = "Success";

        String url = "http://localhost:8099/api/order/submit/" + this.currentUser;

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            request.setHeader("content-type", "application/json");
            request.setHeader("Authorization", this.bearerToken);

            HttpResponse response = httpClient.execute(request);
            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            JsonObject jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);

            // Empty cart when order submission is done
            clearCart(model);
        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }

        return "result";
    }

    public static List<Map<String, Object>> getListOrders() throws Exception {
        List<Map<String, Object>> orders = new ArrayList<Map<String, Object>>();
        Map<String, Object> newOrder = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8099/api/order/history/" + currentUser;

        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            request.setHeader("Authorization", bearerToken);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String orderId = jsonElement.getAsString();


                Gson gson = new Gson();
                Type type = new TypeToken<List<Item>>() {
                }.getType();

                JsonElement itemsElement = tokenList.get(i).getAsJsonObject().get("items");
                List<Item> orderItems = gson.fromJson(itemsElement, type);

                jsonElement = tokenList.get(i).getAsJsonObject().get("total");
                String orderTotal = jsonElement.getAsString();


                newOrder = new HashMap<String, Object>() {
                    {
                        put("orderId", orderId);
                        put("orderItems", orderItems);
                        put("orderTotal", orderTotal);
                    }
                };
                orders.add(newOrder);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
            String userFeedback = "Ecommerce service is not available";
        }

        return orders;
    }

    public static boolean getEcommerceStatus() throws Exception {
        String url = "http://localhost:8099/api/user/create";
        boolean serviceStatus;

        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);
            serviceStatus = true;
        } catch (Exception e) {
            serviceStatus = false;
        }

        return serviceStatus;
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

    public String printStringItem() {
        String jsonString = "{\n" +
                "  \"name\": \"USED\",\n" +
                "  \"price\": \"1\",\n" +
                "  \"description\": \"1\"\n" +
                "}";
        return jsonString;
    }

    public static String printStringCartRequest() {
        String jsonString = "{\n" +
                "  \"username\": \"USED\"\n" +
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