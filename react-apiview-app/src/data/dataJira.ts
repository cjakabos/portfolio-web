export interface JiraTicket {
    key: string;
    fields: {
        summary: string;
        description: string;
    }
}