package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
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

import com.udacity.jwdnd.course1.cloudinterface.entity.Pet;

@Controller
@RequestMapping("/pet")
public class PetController {


//    public static List<Map<String, String>> getListPets() throws Exception {
//		//String[] pets = {"Volvo", "BMW", "Ford", "Mazda"};
//		List<Map<String, String>> pets = new ArrayList<Map<String, String>>();
//		Map<String, String> newPet = new HashMap<String, String>()
//		{
//			{
//				put("petCondition", "Old");
//				put("petId", "1");
//				put("petModel", "Honda");
//			}
//		};
//		pets.add(newPet);
//		Map<String, String> newPet2 = new HashMap<String, String>()
//		{
//			{
//				put("petCondition", "New");
//				put("petId", "2");
//				put("petModel", "Porsche");
//			}
//		};
//		pets.add(newPet2);
//		return pets;
//        //return "result";
//	}

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

                JsonElement test = tokenList.get(i).getAsJsonObject().get("type");
                String petName = test.toString();
                test = tokenList.get(i).getAsJsonObject().get("name");
                String petType = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("id");
                String petId = test.toString();
                newPet = new HashMap<String, String>() {
                    {
                        put("petName", petName);
                        put("petId", petId);
                        put("petType", petType);
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
                    }
                };
                pets.add(newPet);
		}


        return pets;
        //return "result";
    }

    @PostMapping("/getPets")
    public String getAPIListPets(Authentication authentication,
                                 Model model) throws Exception {
        String userFeedback = "Success";
        model.addAttribute("updateSuccess", userFeedback);
        String url = "http://localhost:8083/pet";

        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpGet request = new HttpGet(url);
        HttpResponse response = httpClient.execute(request);


        HttpEntity entity = response.getEntity();
        String responseString = EntityUtils.toString(entity, "UTF-8");
        System.out.println("ALL JSON OBJECTS" + responseString);
        JsonArray tokenList = JsonParser.parseString(responseString).getAsJsonArray();

        JsonObject oj = tokenList.get(0).getAsJsonObject();
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 1" + oj.toString());

        oj = tokenList.get(1).getAsJsonObject();
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2" + oj.toString());

        JsonElement test = tokenList.get(1).getAsJsonObject().get("type");
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2 condition" + test.toString());

        test = tokenList.get(1).getAsJsonObject().get("name");
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2 details/model" + test.toString());
        return "result";
    }

    @PostMapping("/addPet")
    public String insertOrUpdatePet(Authentication authentication,
                                    @ModelAttribute("newPetModel") Pet pet,
                                    Model model) throws Exception {
        List<Map<String, String>> pets = new ArrayList<Map<String, String>>();
        pets = getListPets();
        String userFeedback = "Success";

        String url = "http://localhost:8083/pet/1";

		//json.put("reference", url);
        //Gson gson = new Gson();
        //JSONObject json = new JSONObject();
        //json.put(printString(), url);


        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            HttpPost request = new HttpPost(url);

            //params.setContentType("application/json");
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            System.out.println("jsonObject is: " + jsonObject.toString());
            //jsonObject.put("name", pet.getPetModel());
            //jsonObject.remove("type");

            jsonObject.addProperty("type", pet.getPetName());
            jsonObject.addProperty("name", pet.getPetType());
            jsonObject.addProperty("owner", "1");

            System.out.println(jsonObject.toString());
            if (pet.getPetName().equals("CAT") || pet.getPetName().equals("DOG")) {
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

                String petIdAPI = jsonObject.getAsJsonObject().get("id").toString();

                pet.setPetType(petIdAPI);
                model.addAttribute("pet", pet);
                System.out.println("Pet is successsfully added");
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
    public String editPet(@ModelAttribute("newPetModel") Pet pet,
                            Model model) throws IOException {
        String url = "http://localhost:8083/pets/" + pet.getPetId();
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
		String userFeedback = "Success";

            HttpPost request = new HttpPost(url);

            //params.setContentType("application/json");
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            //jsonObject.put("name", pet.getPetModel());
            //jsonObject.remove("type");
            jsonObject.addProperty("type", pet.getPetName());
            jsonObject.getAsJsonObject("details").addProperty("name", pet.getPetType());

            if (pet.getPetName().equals("CAT") || pet.getPetName().equals("DOG")) {
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

    public String printString() {
        String jsonString = "{\n" +
                "  \"type\": \"CAT\",\n" +
                "  \"name\": \"Kilo\",\n" +
                "  \"ownerId\": \"1\",\n" +
                "  \"birthDate\": \"2019-12-16T04:43:57.995Z\",\n" +
                "  \"notes\": \"OWN NOTES\"\n" +
                "}";
        return jsonString;
    }
}
