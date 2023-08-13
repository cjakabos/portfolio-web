package com.example.demo.controllers;

import org.apache.http.HttpEntity;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.apache.http.HttpResponse;
import java.io.IOException;

@CrossOrigin(origins = "http://localhost:5001")
@RestController
@RequestMapping("/webDomain")
public class WebController {

    public static final Logger log = LoggerFactory.getLogger(WebController.class);

    @CrossOrigin(origins = "http://localhost:5001")
    @PostMapping("/get")
    public ResponseEntity<Object> getTicket(@RequestBody String json) throws IOException {

        JSONObject jsonObject = new JSONObject(json);
        HttpClient httpClient = HttpClientBuilder.create().build();


        HttpGet request = new HttpGet(jsonObject.get("webDomain").toString());
        request.addHeader("Authorization", jsonObject.get("webApiKey").toString());
        jsonObject.remove("webDomain");
        jsonObject.remove("webApiKey");

        HttpResponse response;
        response = httpClient.execute(request);
        HttpEntity entity = response.getEntity();
        String responseString = EntityUtils.toString(entity, "UTF-8");
        JSONObject jsonResponse = new JSONObject(responseString);

        return new ResponseEntity<>(jsonResponse.toMap(), HttpStatus.OK);
    }

}
