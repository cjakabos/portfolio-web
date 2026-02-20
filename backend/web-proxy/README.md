Web-Proxy API to avoid CORS issues with external services. Listens on port 8501.

```
mvn clean package
java -jar target/web-proxy-0.0.1-SNAPSHOT.jar
```

The proxy now uses Jira credentials from environment variables (`JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`).
Clients must send only the Jira API path via `jiraPath`; arbitrary domains are blocked.

In a Jira example, `fields` is the request body for
[create a new ticket](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post).

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
  "jiraPath": "/rest/api/latest/issue"
}
```
