package com.udacity.jwdnd.course1.cloudinterface.entity;

public class OpenAi {
    private Integer openAiId;
    private String openAiQuestion;
    private String openAiAnswer;
    private Integer userId;

    public OpenAi() {
    }

    public OpenAi(Integer openAiId, String openAiQuestion, Integer userId) {
        this.openAiId = openAiId;
        this.openAiQuestion = openAiQuestion;
        this.openAiAnswer = openAiAnswer;
        this.userId = userId;
    }

    public Integer getOpenAiId() {
        return openAiId;
    }

    public void setOpenAiId(Integer openAiId) {
        this.openAiId = openAiId;
    }

    public String getOpenAiQuestion() {
        return openAiQuestion;
    }

    public void setOpenAiQuestion(String openAiQuestion) {
        this.openAiQuestion = openAiQuestion;
    }

    public String getOpenAiAnswer() {
        return openAiAnswer;
    }

    public void setOpenAiAnswer(String openAiAnswer) {
        this.openAiAnswer = openAiAnswer;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }
}
