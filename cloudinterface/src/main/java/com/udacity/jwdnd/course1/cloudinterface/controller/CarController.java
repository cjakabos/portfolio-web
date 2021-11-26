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

import static java.lang.System.*;

import java.lang.String;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

import org.apache.http.entity.StringEntity;

import org.apache.http.impl.client.HttpClientBuilder;
import org.json.simple.JSONArray;
import org.json.JSONObject;
import com.google.gson.*;

import java.util.*;

import com.udacity.jwdnd.course1.cloudinterface.entity.Car;

@Controller
@RequestMapping("/car")
public class CarController {


//    public static List<Map<String, String>> getListCars() throws Exception {
//		//String[] cars = {"Volvo", "BMW", "Ford", "Mazda"};
//		List<Map<String, String>> cars = new ArrayList<Map<String, String>>();
//		Map<String, String> newCar = new HashMap<String, String>()
//		{
//			{
//				put("carCondition", "Old");
//				put("carId", "1");
//				put("carModel", "Honda");
//			}
//		};
//		cars.add(newCar);
//		Map<String, String> newCar2 = new HashMap<String, String>()
//		{
//			{
//				put("carCondition", "New");
//				put("carId", "2");
//				put("carModel", "Porsche");
//			}
//		};
//		cars.add(newCar2);
//		return cars;
//        //return "result";
//	}

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

            //JsonObject jsnobject = new JsonObject(responseString);

            JsonArray tokenList = jsonObject.getAsJsonObject("_embedded").getAsJsonArray("carList");

            for (int i = 0; i < tokenList.size(); i++) {
                JsonObject oj = tokenList.get(i).getAsJsonObject();
                oj = tokenList.get(i).getAsJsonObject();

                JsonElement test = tokenList.get(i).getAsJsonObject().get("condition");
                String carCondition = test.toString();
                test = tokenList.get(i).getAsJsonObject().get("details").getAsJsonObject().get("model");
                String carModel = test.toString();

                test = tokenList.get(i).getAsJsonObject().get("id");
                String carId = test.toString();
                newCar = new HashMap<String, String>() {
                    {
                        put("carCondition", carCondition);
                        put("carId", carId);
                        put("carModel", carModel);
                    }
                };
                cars.add(newCar);
            }
        } catch (Exception e) {
            //  Block of code to handle errors
				String userFeedback = "Car API is down or empty data";
                newCar = new HashMap<String, String>() {
                    {
                        put("carCondition", userFeedback);
                        put("carId", userFeedback);
                        put("carModel", userFeedback);
                    }
                };
                cars.add(newCar);
		}


        return cars;
        //return "result";
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
        System.out.println("ALL JSON OBJECTS" + responseString);
        JsonObject jsonObject = JsonParser.parseString(responseString).getAsJsonObject();
        //JsonObject jsnobject = new JsonObject(responseString);

        JsonArray tokenList = jsonObject.getAsJsonObject("_embedded").getAsJsonArray("carList");
        JsonObject oj = tokenList.get(0).getAsJsonObject();
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 1" + oj.toString());

        oj = tokenList.get(1).getAsJsonObject();
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2" + oj.toString());

        JsonElement test = tokenList.get(1).getAsJsonObject().get("condition");
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2 condition" + test.toString());

        test = tokenList.get(1).getAsJsonObject().get("details").getAsJsonObject().get("model");
        //String token = oj.get;
        System.out.println("---------------------------------------");
        System.out.println("jsonObject of 2 details/model" + test.toString());
        return "result";
    }

    @PostMapping("/addCar")
    public String insertOrUpdateCar(Authentication authentication,
                                    @ModelAttribute("newCarModel") Car car,
                                    Model model) throws Exception {
        List<Map<String, String>> cars = new ArrayList<Map<String, String>>();
        cars = getListCars();



        String userFeedback = "Success";
        System.out.println("This adds car");
        System.out.println(printString());

        System.out.println("getCarCondition is: " + car.getCarCondition());
        String url;
        if (car.getCarId() == null) {
            url = "http://localhost:8080/cars";
        } else {
            url = "http://localhost:8080/cars/" + car.getCarId().toString();
        }

		//json.put("reference", url);
        //Gson gson = new Gson();
        //JSONObject json = new JSONObject();
        //json.put(printString(), url);


        // @Deprecated HttpClient httpClient = new DefaultHttpClient();
        HttpClient httpClient = HttpClientBuilder.create().build();
        try {
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            //jsonObject.put("model", car.getCarModel());
            //jsonObject.remove("condition");
            jsonObject.addProperty("condition", car.getCarCondition());
            jsonObject.getAsJsonObject("details").addProperty("model", car.getCarModel());

            if (car.getCarCondition().equals("NEW") || car.getCarCondition().equals("USED")) {
                userFeedback = "Success";
                model.addAttribute("updateSuccess", userFeedback);
                StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

                HttpResponse response;
                if (car.getCarId() == null) {
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

                car.setCarModel(carIdAPI);
                model.addAttribute("car", car);
                System.out.println("Car is successsfully added");
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
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpDelete request = new HttpDelete(url);
        HttpResponse response = httpClient.execute(request);

        String userFeedback = "Success";
        //nService.deleteCar(carId);
        model.addAttribute("updateSuccess", userFeedback);
        System.out.println("This deletes car");
        return "result";
    }

    @GetMapping(value = "/cars/{carId}")
    public String editCar(@ModelAttribute("newCarModel") Car car,
                            Model model) throws IOException {
        String url = "http://localhost:8080/cars/" + car.getCarId();
        System.out.println("url: " + url);
        HttpClient httpClient = HttpClientBuilder.create().build();
		String userFeedback = "Success";

            HttpPost request = new HttpPost(url);

            //params.setContentType("application/json");
            JsonObject jsonObject = JsonParser.parseString(printString()).getAsJsonObject();
            //jsonObject.put("model", car.getCarModel());
            //jsonObject.remove("condition");
            jsonObject.addProperty("condition", car.getCarCondition());
            jsonObject.getAsJsonObject("details").addProperty("model", car.getCarModel());

            if (car.getCarCondition().equals("NEW") || car.getCarCondition().equals("USED")) {
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

                car.setCarModel(carIdAPI);
                model.addAttribute("car", car);
                System.out.println("Car is successsfully added");
            } else {
                userFeedback = "Model should be either USED or NEW";
                model.addAttribute("updateError", userFeedback);
            }
			
			
        return "result";
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
