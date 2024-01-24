package com.udacity.jwdnd.course1.cloudinterface.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class OpenAi {
    private Integer openAiId;
    private String openAiQuestion;
    private String openAiImageQuestion;
    private String openAiAnswer;
    private Integer userId;

    private String openAiSize;
    private Integer openAiN;

    private List<Map<String, String>> openAiImageAnswer = new ArrayList<Map<String, String>>();

    public OpenAi() {
    }

    public OpenAi(Integer openAiId, String openAiQuestion, String openAiImageQuestion, String openAiAnswer, Integer userId, String openAiSize, Integer openAiN, List<Map<String, String>> openAiImageAnswer) {
        this.openAiId = openAiId;
        this.openAiQuestion = openAiQuestion;
        this.openAiImageQuestion = openAiImageQuestion;
        this.openAiAnswer = openAiAnswer;
        this.userId = userId;
        this.openAiSize = openAiSize;
        this.openAiN = openAiN;
        this.openAiImageAnswer = openAiImageAnswer;
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
    public String getOpenAiImageQuestion() {
        return openAiImageQuestion;
    }

    public void setOpenAiImageQuestion(String openAiImageQuestion) {
        this.openAiImageQuestion = openAiImageQuestion;
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
    public String getOpenAiSize() {
        return openAiSize;
    }

    public void setOpenAiSize(String openAiSize) {
        this.openAiSize = openAiSize;
    }

    public Integer getOpenAiN() {
        return openAiN;
    }

    public void setOpenAiN(Integer openAiN) {
        this.openAiN = openAiN;
    }

    public List<Map<String, String>> getOpenAiImageAnswer() {
        return openAiImageAnswer;
    }

    public void setOpenAiAnswer(List<Map<String, String>> openAiImageAnswer) {
        this.openAiImageAnswer = openAiImageAnswer;
    }
}
