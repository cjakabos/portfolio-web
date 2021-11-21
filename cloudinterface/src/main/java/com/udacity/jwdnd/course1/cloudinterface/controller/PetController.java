package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;
import org.apache.http.HttpEntity;
import org.apache.http.HttpRequest;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.util.EntityUtils;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import static java.lang.System.*;

import java.lang.String;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

import org.apache.http.client.methods.HttpPost;
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
            String userFeedback = "Pet API is down or empty data";
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
            String userFeedback = "Owner API is down or empty data";
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
            String userFeedback = "Employee API is down or empty data";
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

        String url = "http://localhost:8083/pet/1";

        //json.put("reference", url);
        //Gson gson = new Gson();
        //JSONObject json = new JSONObject();
        //json.put(printPetString(), url);


        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            //params.setContentType("application/json");
            JsonObject jsonObject = JsonParser.parseString(printPetString()).getAsJsonObject();
            System.out.println("jsonObject is: " + jsonObject.toString());
            //jsonObject.put("name", pet.getPetModel());
            //jsonObject.remove("type");

            jsonObject.addProperty("type", pet.getPetType());
            jsonObject.addProperty("name", pet.getPetName());
            jsonObject.addProperty("owner", "1");

            System.out.println(jsonObject.toString());
            if (pet.getPetType().equals("CAT") || pet.getPetType().equals("DOG")) {
                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
                StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

                //request.addHeader("content-type", "application/x-www-form-urlencoded");
                request.addHeader("content-type", "application/json");
                request.setEntity(params);
                System.out.println("TEST1");
                HttpResponse response = httpClient.execute(request);
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
                userFeedback = "Model should be either CAT or DOG";
                model.addAttribute("updateError", userFeedback);
            }

        } catch (Exception ex) {
        } finally {
            // @Deprecated httpClient.getConnectionManager().shutdown();
        }


        return "result";
    }

    @GetMapping(value = "/delete/{petId}")
    public String deletePet(@PathVariable Integer petId,
                            Model model) throws IOException {
        String url = "http://localhost:8083/pets/" + petId;
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        //nService.deletePet(petId);
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes pet");
        return "result";
    }

    @GetMapping(value = "/pets/{petId}")
    public String editPet(@ModelAttribute("newPet") Pet pet,
                          Model model) throws IOException {
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

        if (pet.getPetType().equals("CAT") || pet.getPetType().equals("DOG")) {
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
            userFeedback = "Model should be either CAT or DOG";
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
    public List<String> getEmployeeSkillsList() {
        List<String> skills = Arrays.asList("PETTING", "WALKING", "FEEDING", "MEDICATING", "SHAVING");
        return skills;
    }
    public List<String> getPetTypes() {
        List<String> skills = Arrays.asList("CAT", "DOG", "LIZARD", "BIRD", "FISH", "SNAKE", "OTHER");
        return skills;
    }
}
