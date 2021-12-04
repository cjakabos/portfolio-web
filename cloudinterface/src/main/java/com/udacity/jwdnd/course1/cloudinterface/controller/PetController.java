package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
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

import static java.lang.System.*;

import java.lang.String;
import java.io.*;
import java.lang.reflect.Type;
import java.net.HttpURLConnection;
import java.net.URL;

import org.apache.http.entity.StringEntity;

import org.apache.http.impl.client.HttpClientBuilder;
import org.json.simple.JSONArray;
import org.json.JSONObject;
import com.google.gson.*;

import java.util.*;

import com.udacity.jwdnd.course1.cloudinterface.entity.*;

@Controller
@RequestMapping("/pet")
public class PetController {

    public static List<Map<String, String>> getListPets() throws Exception {
        List<Map<String, String>> pets = new ArrayList<Map<String, String>>();
        Map<String, String> newPet = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8083/pet";
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("name");
                String petName = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("type");
                String petType = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String petId = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("ownerId");
                String petOwnerId = jsonElement.getAsString();

                newPet = new HashMap<String, String>() {
                    {
                        put("petName", petName);
                        put("petId", petId);
                        put("petType", petType);
                        put("petOwnerId", petOwnerId);
                    }
                };
                pets.add(newPet);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }


        return pets;
        //return "result";
    }
    public static List<Map<String, String>> getListOwners() throws Exception {
        List<Map<String, String>> owners = new ArrayList<Map<String, String>>();
        Map<String, String> newOwner = new HashMap();

        String url = "http://localhost:8083/user/customer";
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();
            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("name");
                String ownerName = jsonElement.getAsString();
                jsonElement = tokenList.get(i).getAsJsonObject().get("phoneNumber");
                String ownerPhoneNumber = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String ownerId = jsonElement.getAsString();
                newOwner = new HashMap<String, String>() {
                    {
                        put("ownerName", ownerName);
                        put("ownerId", ownerId);
                        put("ownerPhoneNumber", ownerPhoneNumber);
                    }
                };
                owners.add(newOwner);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }


        return owners;
        //return "result";
    }

    public static List<Map<String, String>> getListEmployees() throws Exception {
        List<Map<String, String>> employees = new ArrayList<Map<String, String>>();
        Map<String, String> newEmployee = new HashMap();

        String url = "http://localhost:8083/user/employee";
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("name");
                String employeeName = jsonElement.getAsString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("skills");
                String employeeSkills = jsonElement.toString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("daysAvailable");
                String employeeSchedule = jsonElement.toString();

                jsonElement = tokenList.get(i).getAsJsonObject().get("id");
                String employeeId = jsonElement.getAsString();
                newEmployee = new HashMap<String, String>() {
                    {
                        put("employeeName", employeeName);
                        put("employeeId", employeeId);
                        put("employeeSkills", employeeSkills);
                        put("employeeSchedule", employeeSchedule);
                    }
                };
                employees.add(newEmployee);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }


        return employees;
        //return "result";
    }

    public static List<Map<String, List<String>>> getListSchedules() throws Exception {
        List<Map<String, List<String>>> schedules = new ArrayList<Map<String, List<String>>>();
        Map<String, List<String>> newSchedule = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8083/schedule";
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                Gson gson = new Gson();
                Type type = new TypeToken<List<String>>(){}.getType();

                JsonElement idElement = tokenList.get(i).getAsJsonObject().get("id");
                JsonArray tempArrayId = new JsonArray();
                tempArrayId.add(idElement);
                List<String> scheduleId = gson.fromJson(tempArrayId, type);

                JsonElement dateElement = tokenList.get(i).getAsJsonObject().get("date");
                JsonArray tempArray = new JsonArray();
                tempArray.add(dateElement);
                List<String> scheduleDate = gson.fromJson(tempArray, type);

                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("activities");
                List<String> scheduleActivities = gson.fromJson(jsonElement, type);

                jsonElement = tokenList.get(i).getAsJsonObject().get("employeeIds");
                List<String> employeeIds = gson.fromJson(jsonElement, type);

                jsonElement = tokenList.get(i).getAsJsonObject().get("petIds");
                List<String> petIds = gson.fromJson(jsonElement, type);

                newSchedule = new HashMap<String, List<String>>() {
                    {
                        put("id", scheduleId);
                        put("date", scheduleDate);
                        put("activities", scheduleActivities);
                        put("employeeIds", employeeIds);
                        put("petIds", petIds);
                    }
                };
                schedules.add(newSchedule);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
        }


        return schedules;
    }

    @PostMapping("/addPet")
    public String insertOrUpdatePet(Authentication authentication,
                                    @ModelAttribute("newPet") Pet pet,
                                    Model model) throws Exception {
        //List<Map<String, String>> pets = new ArrayList<Map<String, String>>();
        //pets = getListPets();
        String userFeedback = "Success";

        String url;

        if (pet.getPetId() == null) {
            url = "http://localhost:8083/pet";
        } else {
            url = "http://localhost:8083/pet/" + pet.getPetId().toString();
        }

        //json.put("reference", url);
        //Gson gson = new Gson();
        //JSONObject json = new JSONObject();
        //json.put(printPetString(), url);


        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            JsonObject jsonObject = JsonParser.parseString(printPetString()).getAsJsonObject();
            //jsonObject.put("name", pet.getPetModel());
            //jsonObject.remove("type");

            jsonObject.addProperty("type", pet.getPetType());
            jsonObject.addProperty("name", pet.getPetName());
            jsonObject.addProperty("ownerId", pet.getPetOwnerId());

            if (getPetTypes().stream()
                    .filter(animal -> pet.getPetType().equals(animal.toString()))
                    .findFirst()
                    .orElse(null) != null) {
                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
                StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

                //request.addHeader("content-type", "application/x-www-form-urlencoded");
                HttpResponse response;
                if (pet.getPetId() == null) {
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


                Integer petIdAPI = jsonObject.getAsJsonObject().get("id").getAsInt();

                pet.setPetId(petIdAPI);
                Integer petOwnerIdAPI = jsonObject.getAsJsonObject().get("ownerId").getAsInt();

                pet.setPetId(petIdAPI);
                pet.setPetId(petOwnerIdAPI);

                model.addAttribute("pet", pet);
            } else {
                userFeedback = "Pet should be either: " + getPetTypes().toString();
                model.addAttribute("updateError", userFeedback);
            }

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/deletePet/{petId}")
    public String deletePet(@PathVariable Integer petId,
                            Model model) throws IOException {
        String url = "http://localhost:8083/pet/" + petId;
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    @GetMapping(value = "/pets/{petId}")
    public String editPet(@ModelAttribute("newPet") Pet pet,
                          Model model) throws Exception {
        String url = "http://localhost:8083/pets/" + pet.getPetId();
        HttpClient httpClient = HttpClientBuilder.create().build();
        String userFeedback = "Success";

        HttpPost request = new HttpPost(url);

        JsonObject jsonObject = JsonParser.parseString(printPetString()).getAsJsonObject();
        jsonObject.addProperty("type", pet.getPetType());
        jsonObject.getAsJsonObject("details").addProperty("name", pet.getPetName());

        if (getPetTypes().stream()
                .filter(animal -> pet.getPetType().equals(animal.toString()))
                .findFirst()
                .orElse(null) != null) {
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


            String petIdAPI = jsonObject.getAsJsonObject().get("id").toString();

            pet.setPetType(petIdAPI);
            model.addAttribute("pet", pet);
        } else {
            userFeedback = "Pet should be either: " + getPetTypes().toString();
            model.addAttribute("updateError", userFeedback);
        }


        return "result";
    }

    @PostMapping("/addOwner")
    public String insertOrUpdateOwner(Authentication authentication,
                                      @ModelAttribute("newOwner") Owner owner,
                                      Model model) throws Exception {
        List<Map<String, String>> owners = new ArrayList<Map<String, String>>();
        //owners = getListOwners();
        String userFeedback = "Success";

        String url = "http://localhost:8083/user/customer";


        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            JsonObject jsonObject = JsonParser.parseString(printOwnerString()).getAsJsonObject();
            jsonObject.addProperty("name", owner.getOwnerName());
            jsonObject.addProperty("phoneNumber", owner.getOwnerPhoneNumber());
            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);

            HttpResponse response = httpClient.execute(request);


            HttpEntity entity = response.getEntity();

            String responseString = EntityUtils.toString(entity, "UTF-8");

            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();


            model.addAttribute("owner", owner);
        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/deleteOwner/{ownerId}")
    public String deleteOwner(@PathVariable Integer ownerId,
                            Model model) throws IOException {
        String url = "http://localhost:8083/user/customer/" + ownerId;
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    @PostMapping("/addEmployee")
    public String insertOrUpdateEmployee(Authentication authentication,
                                         @ModelAttribute("newEmployee") Employee employee,
                                         Model model) throws Exception {
        List<Map<String, String>> employees = new ArrayList<Map<String, String>>();
        //employees = getListEmployees();
        String userFeedback = "Success";

        String url = "http://localhost:8083/user/employee";

        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            JsonObject jsonObject = JsonParser.parseString(printEmployeeString()).getAsJsonObject();
            jsonObject.addProperty("name", employee.getEmployeeName());

            Gson gson = new Gson();
            JsonElement element = gson.toJsonTree(employee.getEmployeeSkills(), new TypeToken<List<String>>() {}.getType());
            jsonObject.add("skills", element.getAsJsonArray());

            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);

            HttpResponse response = httpClient.execute(request);

            HttpEntity entity = response.getEntity();

            String responseString = EntityUtils.toString(entity, "UTF-8");

            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            String employeeIdAPI = jsonObject.getAsJsonObject().get("id").toString();

            //employee.setEmployeeId(employeeIdAPI);
            model.addAttribute("employee", employee);
        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }
    @PostMapping("/addEmployeeSchedule")
    public String addEmployeeSchedule(Authentication authentication,
                                      @ModelAttribute("newEmployee") Employee employee,
                                      Model model) throws Exception {


        String url = "http://localhost:8083/user/employee/" + employee.getEmployeeId();

        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPut request = new HttpPut(url);

            Gson gson = new Gson();
            JsonElement element = gson.toJsonTree(employee.getEmployeeSchedule(), new TypeToken<List<String>>() {}.getType());

            StringEntity params = new StringEntity(element.toString(), "UTF-8");
            request.addHeader("content-type", "application/json");
            request.setEntity(params);

            HttpResponse response = httpClient.execute(request);

            String userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/deleteEmployee/{employeeId}")
    public String deleteEmployee(@PathVariable Integer employeeId,
                              Model model) throws IOException {
        String url = "http://localhost:8083/user/employee/" + employeeId;
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    @PostMapping("/assignSchedule")
    public String assignSchedule(Authentication authentication,
                                      @ModelAttribute("newSchedule") Schedule schedule,
                                      Model model) throws Exception {


        String url = "http://localhost:8083/schedule";

        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            JsonObject jsonObject = JsonParser.parseString(printScheduleString()).getAsJsonObject();
            jsonObject.addProperty("date", schedule.getDate().toString());

            Gson gson = new Gson();
            JsonElement element = gson.toJsonTree(schedule.getEmployeeIds(), new TypeToken<List<String>>() {}.getType());
            jsonObject.add("employeeIds", element.getAsJsonArray());
            element = gson.toJsonTree(schedule.getPetIds(), new TypeToken<List<String>>() {}.getType());
            jsonObject.add("petIds", element.getAsJsonArray());
            element = gson.toJsonTree(schedule.getActivities(), new TypeToken<List<String>>() {}.getType());
            jsonObject.add("activities", element.getAsJsonArray());

            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");
            request.addHeader("content-type", "application/json");
            request.setEntity(params);
            
            HttpResponse response = httpClient.execute(request);

            String userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/deleteSchedule/{scheduleId}")
    public String deleteSchedule(@PathVariable Integer scheduleId,
                              Model model) throws IOException {
        String url = "http://localhost:8083/schedule/" + scheduleId;
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }

    public static boolean getPetStatus() throws Exception {
        String url = "http://localhost:8083/pet";
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

    public String printPetString() {
        String jsonString = "{\n" +
                "  \"type\": \"CAT\",\n" +
                "  \"name\": \"Kilo\",\n" +
                "  \"ownerId\": \"1\",\n" +
                "  \"birthDate\": \"2019-12-16T04:43:57.995Z\",\n" +
                "  \"notes\": \"OWN NOTES\"\n" +
                "}";
        return jsonString;
    }
    public String printOwnerString() {
        String jsonString = "{\n" +
                "  \"name\": \"Alex\",\n" +
                "  \"phoneNumber\": \"461\"\n" +
                "}";
        return jsonString;
    }
    public String printEmployeeString() {
        String jsonString = "{\n" +
                "  \"name\": \"Alex\",\n" +
                "  \"skills\": \"PETTING\"\n" +
                "}";
        return jsonString;
    }
    public String printScheduleString() {
        String jsonString = "{\n" +
                "  \"employeeIds\": \"Alex\",\n" +
                "  \"petIds\": \"Alex\",\n" +
                "  \"date\": \"Alex\",\n" +
                "  \"activities\": \"PETTING\"\n" +
                "}";
        return jsonString;
    }
    public static List<String> getEmployeeSkillsList() {
        List<String> skills = Arrays.asList("PETTING", "WALKING", "FEEDING", "MEDICATING", "SHAVING");
        return skills;
    }
    public static List<String> getPetTypes() {
        List<String> types = Arrays.asList("CAT", "DOG", "LIZARD", "BIRD", "FISH", "SNAKE", "OTHER");
        return types;
    }
    public static List<String> getDays() {
        List<String> days = Arrays.asList("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY");
        return days;
    }
}
