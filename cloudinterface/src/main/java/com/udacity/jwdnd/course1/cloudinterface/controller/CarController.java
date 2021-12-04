package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.apache.http.HttpEntity;
import org.apache.http.HttpRequest;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.*;
import org.apache.http.util.EntityUtils;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.lang.String;
import java.io.*;

import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import com.google.gson.*;

import java.util.*;

import com.udacity.jwdnd.course1.cloudinterface.entity.Car;

@Controller
@RequestMapping("/car")
public class CarController {

    public static List<Map<String, String>> getListCars() throws Exception {
        List<Map<String, String>> cars = new ArrayList<Map<String, String>>();
        Map<String, String> newCar = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8080/cars";

        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);


            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonObject jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            JsonArray tokenList = jsonObject.getAsJsonObject("_embedded").getAsJsonArray("carList");

            for (int i = 0; i < tokenList.size(); i++) {
                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("condition");
                String carCondition = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("model");
                String carModel = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("productionYear");
                String carProductionYear = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("manufacturer").getAsJsonObject().get("code");
                String carCode = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("manufacturer").getAsJsonObject().get("name");
                String carName = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("numberOfDoors");
                String numberOfDoors = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("fuelType");
                String fuelType = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("mileage");
                String mileage = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("modelYear");
                String modelYear = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("externalColor");
                String externalColor = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("location").getAsJsonObject().get("lat");
                String latLocation = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("location").getAsJsonObject().get("lon");
                String longLocation = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String carId = jsonElement.getAsString();
                newCar = new HashMap<String, String>() {
                    {
                        put("condition", carCondition);
                        put("id", carId);
                        put("model", carModel);
                        put("productionYear", carProductionYear);
                        put("code", carCode);
                        put("name", carName);
                        put("numberOfDoors", numberOfDoors);
                        put("fuelType", fuelType);
                        put("mileage", mileage);
                        put("modelYear", modelYear);
                        put("externalColor", externalColor);
                        put("latLocation", latLocation);
                        put("longLocation", longLocation);
                    }
                };
                cars.add(newCar);
            }
        } catch (Exception e) {
        }
        return cars;
    }

    @PostMapping("/getCars")
    public String getAPIListCars(Authentication authentication,
                                 Model model) throws Exception {
        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        String url = "http://localhost:8080/cars";

        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpGet request = new HttpGet(url);
        HttpResponse response = httpClient.execute(request);


        HttpEntity entity = response.getEntity();
        String responseString = EntityUtils.toString(entity, "UTF-8");
        JsonObject jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

        JsonArray tokenList = jsonObject.getAsJsonObject("_embedded").getAsJsonArray("carList");
        JsonObject oj = tokenList.get(0).getAsJsonObject();


        JsonElement jsonElement = tokenList.get(1).getAsJsonObject().get("condition");

        jsonElement = tokenList.get(1).getAsJsonObject().get("details").getAsJsonObject().get("model");

        return "result";
    }

    @PostMapping("/addCar")
    public String insertOrUpdateCar(Authentication authentication,
                                    @ModelAttribute("newCarModel") Car car,
                                    Model model) throws Exception {
        String userFeedback = "Success";

        String url;
        if (car.getId() == null) {
            url = "http://localhost:8080/cars";
        } else {
            url = "http://localhost:8080/cars/" + car.getId().toString();
        }

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            jsonObject.addProperty("condition", car.getCondition());
            jsonObject.getAsJsonObject("details").addProperty("model", car.getModel());
            jsonObject.getAsJsonObject("details").addProperty("productionYear", car.getProductionYear());
//            jsonObject.getAsJsonObject("details").addProperty("body", car.getBody());
//            jsonObject.getAsJsonObject("details").getAsJsonObject("manufacturer").addProperty("code", car.getCode());
            jsonObject.getAsJsonObject("details").getAsJsonObject("manufacturer").addProperty("name", car.getName());
            jsonObject.getAsJsonObject("details").addProperty("numberOfDoors", car.getNumberOfDoors());
            jsonObject.getAsJsonObject("details").addProperty("fuelType", car.getFuelType());
            jsonObject.getAsJsonObject("details").addProperty("engine", car.getEngine());
            jsonObject.getAsJsonObject("details").addProperty("mileage", car.getMileage());
            jsonObject.getAsJsonObject("details").addProperty("modelYear", car.getModelYear());
            jsonObject.getAsJsonObject("details").addProperty("externalColor", car.getExternalColor());
            jsonObject.getAsJsonObject("location").addProperty("lat", car.getLatLocation());
            jsonObject.getAsJsonObject("location").addProperty("lon", car.getLongLocation());

            if (car.getCondition().equals("NEW") || car.getCondition().equals("USED")) {
                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
                StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

                HttpResponse response;
                if (car.getId() == null) {
                    HttpPost request = new HttpPost(url);
                    request.addHeader("content-type", "application/json");
                    request.setEntity(params);
                    response = httpClient.execute(request);
                } else {
                    HttpPut request = new HttpPut(url);
                    request.addHeader("content-type", "application/json");
                    request.setEntity(params);
                    response = httpClient.execute(request);
                }

                HttpEntity entity = response.getEntity();
                String responseString = EntityUtils.toString(entity, "UTF-8");
                jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

                String carIdAPI = jsonObject.getAsJsonObject().get("id").toString();

                car.setModel(carIdAPI);
                model.addAttribute("car", car);
            } else {
                userFeedback = "Model should be either USED or NEW";
                model.addAttribute("updateError", userFeedback);
            }

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/delete/{carId}")
    public String deleteCar(@PathVariable Integer carId,
                            Model model) throws IOException {
        String url = "http://localhost:8080/cars/" + carId;
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";

        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    @GetMapping(value = "/cars/{carId}")
    public String editCar(@ModelAttribute("newCarModel") Car car,
                          Model model) throws IOException {
        String url = "http://localhost:8080/cars/" + car.getId();
        HttpClient httpClient = HttpClientBuilder.create().build();
        String userFeedback = "Success";

        HttpPost request = new HttpPost(url);

        //params.setContentType("application/json");
        JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
        //jsonObject.put("model", car.getModel());
        //jsonObject.remove("condition");
        jsonObject.addProperty("condition", car.getCondition());
        jsonObject.getAsJsonObject("details").addProperty("model", car.getModel());

        if (car.getCondition().equals("NEW") || car.getCondition().equals("USED")) {
            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            //request.addHeader("content-type", "application/x-www-form-urlencoded");
            request.addHeader("content-type", "application/json");
            request.setEntity(params);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            String carIdAPI = jsonObject.getAsJsonObject().get("id").toString();

            car.setModel(carIdAPI);
            model.addAttribute("car", car);
        } else {
            userFeedback = "Model should be either USED or NEW";
            model.addAttribute("updateError", userFeedback);
        }

        return "result";
    }

    public static boolean getCarStatus() throws Exception {
        String url = "http://localhost:8080/cars";
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
                "  \"condition\": \"USED\",\n" +
                "  \"details\" : {\n" +
                "    \"body\": \"sedan\",\n" +
                "    \"model\": \"Impala\",\n" +
                "    \"manufacturer\" : {\n" +
                "      \"code\": 101,\n" +
                "      \"name\": \"Chevrolet\"\n" +
                "    },\n" +
                "    \"numberOfDoors\": 4,\n" +
                "    \"fuelType\": \"Gasoline\",\n" +
                "    \"engine\": \"3.6L V6\",\n" +
                "    \"mileage\": 32280,\n" +
                "    \"modelYear\": 2018,\n" +
                "    \"productionYear\": 2018,\n" +
                "    \"externalColor\": \"white\"\n" +
                "  },\n" +
                "  \"location\" : {\n" +
                "    \"lat\": 40.73061,\n" +
                "    \"lon\": -73.935242\n" +
                "  }\n" +
                "}";
        return jsonString;
    }

    public static List<String> getConditions() {
        List<String> conditions = Arrays.asList("USED", "NEW");
        return conditions;
    }
}
