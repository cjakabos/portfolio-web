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
        System.out.println("test1");
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);
            System.out.println("test2");

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement test = tokenList.get(i).getAsJsonObject().get("name");
                String petName = test.toString();
                test = tokenList.get(i).getAsJsonObject().get("type");
                String petType = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("id");
                String petId = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("ownerId");
                String petOwnerId = test.toString();

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
            String userFeedback = "Petstore API is down or empty data";
            newPet = new HashMap<String, String>() {
                {
                    put("petName", userFeedback);
                    put("petId", userFeedback);
                    put("petType", userFeedback);
                    put("petOwnerId", userFeedback);
                }
            };
            pets.add(newPet);
        }


        return pets;
        //return "result";
    }
    public static List<Map<String, String>> getListOwners() throws Exception {
        List<Map<String, String>> owners = new ArrayList<Map<String, String>>();
        Map<String, String> newOwner = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8083/user/customer";
        System.out.println("test1");
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);
            System.out.println("test2");

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();
            System.out.println("test3: " + tokenList);
            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement test = tokenList.get(i).getAsJsonObject().get("name");
                String ownerName = test.toString();
                test = tokenList.get(i).getAsJsonObject().get("phoneNumber");
                String ownerPhoneNumber = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("id");
                String ownerId = test.toString();
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
            String userFeedback = "Petstore API is down or empty data";
            newOwner = new HashMap<String, String>() {
                {
                    put("ownerName", userFeedback);
                    put("ownerId", userFeedback);
                    put("ownerPhoneNumber", userFeedback);
                }
            };
            owners.add(newOwner);
        }


        return owners;
        //return "result";
    }

    public static List<Map<String, String>> getListEmployees() throws Exception {
        List<Map<String, String>> employees = new ArrayList<Map<String, String>>();
        Map<String, String> newEmployee = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8083/user/employee";
        System.out.println("test1");
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);
            System.out.println("test2");

            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");

            JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement test = tokenList.get(i).getAsJsonObject().get("name");
                String employeeName = test.toString();
                test = tokenList.get(i).getAsJsonObject().get("skills");
                String employeeSkills = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("id");
                String employeeId = test.toString();
                newEmployee = new HashMap<String, String>() {
                    {
                        put("employeeName", employeeName);
                        put("employeeId", employeeId);
                        put("employeeSkills", employeeSkills);
                    }
                };
                employees.add(newEmployee);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
            String userFeedback = "Petstore API is down or empty data";
            newEmployee = new HashMap<String, String>() {
                {
                    put("employeeName", userFeedback);
                    put("employeeId", userFeedback);
                    put("employeeSkills", userFeedback);
                }
            };
            employees.add(newEmployee);
        }


        return employees;
        //return "result";
    }

    public static List<Map<String, List<String>>> getListSchedules() throws Exception {
        List<Map<String, List<String>>> schedules = new ArrayList<Map<String, List<String>>>();
        Map<String, List<String>> newSchedule = new HashMap();//new HashMap<String, String>();

        String url = "http://localhost:8083/schedule";
        System.out.println("test1");
        try {
            HttpClient httpClient = HttpClientBuilder.create().build();
            HttpGet request = new HttpGet(url);
            HttpResponse response = httpClient.execute(request);
            System.out.println("test2");

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

                JsonElement test = tokenList.get(i).getAsJsonObject().get("activities");
                List<String> scheduleActivities = gson.fromJson(test, type);

                test = tokenList.get(i).getAsJsonObject().get("employeeIds");
                List<String> employeeIds = gson.fromJson(test, type);

                test = tokenList.get(i).getAsJsonObject().get("petIds");
                List<String> petIds = gson.fromJson(test, type);

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
            List<String> userFeedback = new ArrayList<>();
            userFeedback.add("PetStore API is down or empty data");
            newSchedule = new HashMap<String, List<String>>() {
                {
                    put("id", userFeedback);
                    put("date", userFeedback);
                    put("activities", userFeedback);
                    put("employeeIds", userFeedback);
                    put("petIds", userFeedback);
                }
            };
            schedules.add(newSchedule);
        }


        return schedules;
    }
//    @PostMapping("/getPets")
//    public String getAPIListPets(Authentication authentication,
//                                 Model model) throws Exception {
//        String userFeedback = "Success";
//        model.addAttribute("updateSuccess", userFeedback);
//        String url = "http://localhost:8083/pet";
//
//        HttpClient httpClient = HttpClientBuilder.create().build();
//        HttpGet request = new HttpGet(url);
//        HttpResponse response = httpClient.execute(request);
//
//
//        HttpEntity entity = response.getEntity();
//        String responseString = EntityUtils.toString(entity, "UTF-8");
//        System.out.println("ALL JSON OBJECTS" + responseString);
//        JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();
//
//        JsonObject oj = tokenList.get(0).getAsJsonObject();
//        //String token = oj.get;
//        System.out.println("---------------------------------------");
//        System.out.println("jsonObject of 1" + oj.toString());
//
//        oj = tokenList.get(1).getAsJsonObject();
//        //String token = oj.get;
//        System.out.println("---------------------------------------");
//        System.out.println("jsonObject of 2" + oj.toString());
//
//        JsonElement test = tokenList.get(1).getAsJsonObject().get("type");
//        //String token = oj.get;
//        System.out.println("---------------------------------------");
//        System.out.println("jsonObject of 2 condition" + test.toString());
//
//        test = tokenList.get(1).getAsJsonObject().get("name");
//        //String token = oj.get;
//        System.out.println("---------------------------------------");
//        System.out.println("jsonObject of 2 details/model" + test.toString());
//        return "result";
//    }

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
            System.out.println("jsonObject is: " + jsonObject.toString());
            //jsonObject.put("name", pet.getPetModel());
            //jsonObject.remove("type");

            jsonObject.addProperty("type", pet.getPetType());
            jsonObject.addProperty("name", pet.getPetName());
            jsonObject.addProperty("ownerId", pet.getPetOwnerId());

            System.out.println(jsonObject.toString());

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

                System.out.println("TEST2");

                HttpEntity entity = response.getEntity();
                System.out.println("TEST3");
                String responseString = EntityUtils.toString(entity, "UTF-8");

                System.out.println("TEST4\n" + responseString);
                jsonObject = JsonParser.parseString(responseString).getAsJsonObject();
                System.out.println("TEST5");

                Integer petIdAPI = jsonObject.getAsJsonObject().get("id").getAsInt();

                pet.setPetId(petIdAPI);
                Integer petOwnerIdAPI = jsonObject.getAsJsonObject().get("ownerId").getAsInt();

                pet.setPetId(petIdAPI);
                pet.setPetId(petOwnerIdAPI);

                model.addAttribute("pet", pet);
                System.out.println("Pet is successsfully added");
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
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes pet");
        return "result";
    }

    @GetMapping(value = "/pets/{petId}")
    public String editPet(@ModelAttribute("newPet") Pet pet,
                          Model model) throws Exception {
        String url = "http://localhost:8083/pets/" + pet.getPetId();
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        String userFeedback = "Success";

        HttpPost request = new HttpPost(url);

        //params.setContentType("application/json");
        JsonObject jsonObject = JsonParser.parseString(printPetString()).getAsJsonObject();
        //jsonObject.put("name", pet.getPetModel());
        //jsonObject.remove("type");
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
            System.out.println("Pet is successsfully added");
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
            System.out.println(owner.getOwnerId());
            System.out.println(owner.getOwnerName());
            System.out.println(owner.getOwnerPhoneNumber());
            System.out.println(owner.getUserId());
            jsonObject.addProperty("name", owner.getOwnerName());
            jsonObject.addProperty("phoneNumber", owner.getOwnerPhoneNumber());
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


            model.addAttribute("owner", owner);
            System.out.println("Owner is successsfully added");

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
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes owner");
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

        System.out.println(url);
        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);
            JsonObject jsonObject = JsonParser.parseString(printEmployeeString()).getAsJsonObject();
            System.out.println(jsonObject.toString());
            jsonObject.addProperty("name", employee.getEmployeeName());

            Gson gson = new Gson();
            JsonElement element = gson.toJsonTree(employee.getEmployeeSkills(), new TypeToken<List<String>>() {}.getType());
            jsonObject.add("skills", element.getAsJsonArray());

            System.out.println(jsonObject.toString());
            userFeedback = "Success";
            model.addAttribute("updateSuccess", userFeedback);
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            request.addHeader("content-type", "application/json");
            request.setEntity(params);

            HttpResponse response = httpClient.execute(request);
            System.out.println(response.toString());

            HttpEntity entity = response.getEntity();

            String responseString = EntityUtils.toString(entity, "UTF-8");

            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            String employeeIdAPI = jsonObject.getAsJsonObject().get("id").toString();

            //employee.setEmployeeId(employeeIdAPI);
            model.addAttribute("employee", employee);
            System.out.println("Employee is successsfully added");

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

        System.out.println(url);
        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
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
            System.out.println("Employee schedule is successsfully added");

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
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes employee");
        return "result";
    }

    @PostMapping("/assignSchedule")
    public String assignSchedule(Authentication authentication,
                                      @ModelAttribute("newSchedule") Schedule schedule,
                                      Model model) throws Exception {


        String url = "http://localhost:8083/schedule";

        System.out.println(url);
        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            JsonObject jsonObject = JsonParser.parseString(printScheduleString()).getAsJsonObject();
            System.out.println(jsonObject.toString());
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
            System.out.println("Employee schedule is successsfully added");

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
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes schedule");
        return "result";
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
