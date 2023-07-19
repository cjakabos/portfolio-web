package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.google.gson.*;
import com.udacity.jwdnd.course1.cloudinterface.entity.OpenAi;

import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Controller
@RequestMapping("/openai")
public class OpenAiController {


    @Value("${openApiKey}")
    private String bearerToken;
    private static String lastQuestion;
    private static String lastImageQuestion;
    private static String lastAnswer;
    private static List<Map<String, String>> lastImageAnswer;
    private static String openAiUrl = "https://api.openai.com/v1";

    @GetMapping("/getLastQuestion")
    public static String getLastQuestion() throws Exception {
        return lastQuestion;
    }
    @GetMapping("/getLastImageQuestion")
    public static String getLastImageQuestion() throws Exception {
        return lastImageQuestion;
    }
    @GetMapping("/getLastAnswer")
    public static String getLastAnswer() {
        return lastAnswer;
    }

    @GetMapping("/getLastImageAnswer")
    public static List<Map<String, String>> getLastImageAnswer() {
        return lastImageAnswer;
    }

    @PostMapping("/makeCompletition")
    public String makeCompletitionRequest(Authentication authentication,
                                    @ModelAttribute("newOpenAi") OpenAi openAi,
                                    Model model) throws Exception {
        String userFeedback;
        String url;

        url = openAiUrl + "/completions";

        HttpClient httpClient = HttpClientBuilder.create().build();

        try {
            JsonObject jsonObject = JsonParser.parseString(printOpenAiCompletitionString()).getAsJsonObject();
            jsonObject.addProperty("prompt", openAi.getOpenAiQuestion());
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            HttpPost request = new HttpPost(url);
            request.addHeader("Content-Type", "application/json");
            request.addHeader("Authorization", "Bearer " + this.bearerToken);
            request.setEntity(params);

            HttpResponse response;
            response = httpClient.execute(request);
            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();
            JsonElement openAiResponse = jsonObject.get("choices").getAsJsonArray().get(0).getAsJsonObject().get("text");

            lastQuestion = openAi.getOpenAiQuestion();
            lastAnswer = openAiResponse.getAsString();
            model.addAttribute("openAiLastQuestion", OpenAiController.getLastQuestion());
            model.addAttribute("openAiLastAnswer", OpenAiController.getLastAnswer());
            userFeedback = "Success";
            model.addAttribute("openAiAnswer", userFeedback);

        } catch (Exception ex) {
        }



        return "result";
    }

    @PostMapping("/makeImage")
    public String makeImageRequest(Authentication authentication,
                                          @ModelAttribute("newOpenAiImage") OpenAi openAi,
                                          Model model) throws Exception {
        String userFeedback;
        String url;

        url = openAiUrl + "/images/generations";

        HttpClient httpClient = HttpClientBuilder.create().build();

        try {
            JsonObject jsonObject = JsonParser.parseString(printOpenAiImageString()).getAsJsonObject();
            jsonObject.addProperty("prompt", openAi.getOpenAiImageQuestion());
            StringEntity params = new StringEntity(jsonObject.toString(), "UTF-8");

            HttpPost request = new HttpPost(url);
            request.addHeader("Content-Type", "application/json");
            request.addHeader("Authorization", "Bearer " + this.bearerToken);
            request.setEntity(params);

            HttpResponse response;
            response = httpClient.execute(request);
            HttpEntity entity = response.getEntity();
            String responseString = EntityUtils.toString(entity, "UTF-8");
            jsonObject = JsonParser.parseString(responseString).getAsJsonObject();

            lastImageQuestion = openAi.getOpenAiImageQuestion();

            List<Map<String, String>> images = new ArrayList<Map<String, String>>();
            Map<String, String> newImage = new HashMap();

            JsonArray tokenList = jsonObject.get("data").getAsJsonArray();

            for (int i = 0; i < tokenList.size(); i++) {
                JsonElement jsonElement = tokenList.get(i).getAsJsonObject().get("url");
                String imageUrl = jsonElement.getAsString();
                newImage = new HashMap<String, String>() {
                    {
                        put("url", imageUrl);
                    }
                };
                images.add(newImage);
            }
            lastImageAnswer = images;

            model.addAttribute("openAiLastImageQuestion", OpenAiController.getLastImageQuestion());
            model.addAttribute("openAiLastImageAnswer", OpenAiController.getLastImageAnswer());
            model.addAttribute("images", OpenAiController.getLastImageAnswer());
            userFeedback = "Success";
            model.addAttribute("openAiImageAnswer", userFeedback);

        } catch (Exception ex) {
        }



        return "result";
    }

    public String printOpenAiCompletitionString() {
        String jsonString = "{\n" +
                "  \"model\": \"text-davinci-003\",\n" +
                "  \"prompt\": \"Write a limmerick about APIs\",\n" +
                "  \"max_tokens\": 30,\n" +
                "  \"temperature\": 0.7\n" +
                "}";
        return jsonString;
    }

    public String printOpenAiImageString() {
        String jsonString = "{\n" +
                "  \"prompt\": \"A combo of Spock and Kirk from Star Trek\",\n" +
                "  \"n\": 2,\n" +
                "  \"size\": \"256x256\"\n" +
                "}";
        return jsonString;
    }

    public static List<String> getPetTypes() {
        List<String> types = Arrays.asList("CAT", "DOG", "LIZARD", "BIRD", "FISH", "SNAKE", "OTHER");
        return types;
    }

}
