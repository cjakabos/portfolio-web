package com.example.demo.controllers;

import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpDelete;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpPut;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@RestController
@RequestMapping("/webDomain")
public class WebController {

    public static final Logger log = LoggerFactory.getLogger(WebController.class);

    private static final String JIRA_REST_API_PREFIX = "/rest/api/";

    @Value("${jira.domain:}")
    private String jiraDomain;

    @Value("${jira.email:}")
    private String jiraEmail;

    @Value("${jira.api-token:}")
    private String jiraApiToken;

    @PostMapping("/get")
    public ResponseEntity<Object> getTicket(@RequestBody String json) throws IOException {
        JSONObject jsonObject = new JSONObject(json);
        URI targetUri = resolveAndValidateTarget(jsonObject);

        HttpClient httpClient = HttpClientBuilder.create().build();
        HttpGet request = new HttpGet(targetUri);
        request.addHeader("Authorization", buildBasicAuthorization());

        HttpResponse response = httpClient.execute(request);
        HttpEntity entity = response.getEntity();
        String responseString = EntityUtils.toString(entity, StandardCharsets.UTF_8);

        Object jsonResponse;
        if (responseString.trim().startsWith("[")) {
            JSONArray jsonArray = new JSONArray(responseString);
            jsonResponse = jsonArray.toList();
        } else {
            JSONObject jsonObjectTemp = new JSONObject(responseString);
            jsonResponse = jsonObjectTemp.toMap();
        }

        return new ResponseEntity<>(jsonResponse, HttpStatus.valueOf(response.getStatusLine().getStatusCode()));
    }

    @PostMapping("/post")
    public String createTicket(@RequestBody String json) throws IOException {
        JSONObject jsonObject = new JSONObject(json);
        URI targetUri = resolveAndValidateTarget(jsonObject);

        HttpClient httpClient = HttpClientBuilder.create().build();

        HttpPost request = new HttpPost(targetUri);
        request.addHeader("Authorization", buildBasicAuthorization());
        request.addHeader("Content-type", "application/json");

        // Never forward user-supplied routing/auth fields to Jira
        jsonObject.remove("webDomain");
        jsonObject.remove("jiraPath");
        jsonObject.remove("webApiKey");

        StringEntity params = new StringEntity(jsonObject.toString(), StandardCharsets.UTF_8);
        request.setEntity(params);
        HttpResponse response = httpClient.execute(request);

        return EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);
    }

    @PutMapping("/put")
    public String updateTicket(@RequestBody String json) throws IOException {
        JSONObject jsonObject = new JSONObject(json);
        URI targetUri = resolveAndValidateTarget(jsonObject);

        HttpClient httpClient = HttpClientBuilder.create().build();

        HttpPut request = new HttpPut(targetUri);
        request.addHeader("Authorization", buildBasicAuthorization());
        request.addHeader("Content-type", "application/json");

        jsonObject.remove("webDomain");
        jsonObject.remove("jiraPath");
        jsonObject.remove("webApiKey");

        StringEntity params = new StringEntity(jsonObject.toString(), StandardCharsets.UTF_8);
        request.setEntity(params);
        HttpResponse response = httpClient.execute(request);

        return response.getStatusLine().toString();
    }

    @PostMapping("/delete")
    public String deleteTicket(@RequestBody String json) throws IOException {
        JSONObject jsonObject = new JSONObject(json);
        URI targetUri = resolveAndValidateTarget(jsonObject);

        HttpClient httpClient = HttpClientBuilder.create().build();

        HttpDelete request = new HttpDelete(targetUri);
        request.addHeader("Authorization", buildBasicAuthorization());
        request.addHeader("Content-type", "application/json");

        HttpResponse response = httpClient.execute(request);

        return response.getStatusLine().toString();
    }

    private URI resolveAndValidateTarget(JSONObject jsonObject) {
        ensureJiraConfigPresent();

        URI jiraBase;
        try {
            jiraBase = new URI(jiraDomain);
        } catch (URISyntaxException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Invalid Jira base URL configuration");
        }

        String rawPath = jsonObject.optString("jiraPath", "").trim();
        String rawDomain = jsonObject.optString("webDomain", "").trim();

        URI target;
        try {
            if (!rawPath.isBlank()) {
                String normalizedPath = rawPath.startsWith("/") ? rawPath : "/" + rawPath;
                target = jiraBase.resolve(normalizedPath);
            } else if (!rawDomain.isBlank()) {
                target = new URI(rawDomain);
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing Jira target path");
            }
        } catch (URISyntaxException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Jira target URL");
        }

        boolean hostMatches = jiraBase.getHost() != null && jiraBase.getHost().equalsIgnoreCase(target.getHost());
        boolean schemeMatches = jiraBase.getScheme() != null && jiraBase.getScheme().equalsIgnoreCase(target.getScheme());
        boolean portMatches = normalizePort(jiraBase) == normalizePort(target);
        boolean pathAllowed = target.getPath() != null && target.getPath().startsWith(JIRA_REST_API_PREFIX);
        boolean noUserInfo = target.getUserInfo() == null;

        if (!hostMatches || !schemeMatches || !portMatches || !pathAllowed || !noUserInfo) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Target URL is not allowed");
        }

        return target;
    }

    private int normalizePort(URI uri) {
        if (uri.getPort() > -1) {
            return uri.getPort();
        }
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private void ensureJiraConfigPresent() {
        if (jiraDomain == null || jiraDomain.isBlank()
                || jiraEmail == null || jiraEmail.isBlank()
                || jiraApiToken == null || jiraApiToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Jira proxy is not configured");
        }
    }

    private String buildBasicAuthorization() {
        String raw = jiraEmail + ":" + jiraApiToken;
        String encoded = Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        return "Basic " + encoded;
    }
}
