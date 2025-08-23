Web-Proxy API to avoid CORS issues with external services. Listens on port 8500.

```
mvn clean package
java -jar target/web-proxy-0.0.1-SNAPSHOT.jar
```

```json
{
  REQUEST_BODY,
  "webDomain": "URL to send request to",
  "webApiKey": "Basic YOURAPIKEY"
}
```
In a Jira example "fields" it the request body to [create a new ticket](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post)
while webDomain and webApiKey are custom made fields by me, to specifify what URL endpoint and what Authentication you want to use
More details: [Web Proxy API](../../frontend/cloudapp/README.md#web-proxy)
```json
{
  "fields": {
    "project":
    {
      "key": "YOURJIRAPROJECTKEY"
    },
    "summary": "Example summary",
    "description": "Example description",
    "issuetype": {
      "name": "Task"
    }
  },
  "webDomain": "https://XXXXX.atlassian.net/rest/api/latest/issue",
  "webApiKey": "Basic XXXXX"
}
```
