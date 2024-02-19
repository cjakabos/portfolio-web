package com.example.demo.model.persistence.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;


@Getter
@Setter
@Component
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse {

    private int err_code;
    private String err_msg;
    private Object data;

    public ApiResponse() {
    }

    public ApiResponse(int err_code, String err_msg) {
        this.err_code = err_code;
        this.err_msg = err_msg;
    }

    public ApiResponse getApiResponse(ECode ecode) {
        ApiResponse ret = new ApiResponse(
                ECode.NOT_DEFINED.getValue(),
                "Error");
        switch (ecode) {
            case SUCCESS:
                ret = new ApiResponse(
                        ECode.SUCCESS.getValue(),
                        "Success");
                break;
            case FAILED:
                ret = new ApiResponse(
                        ECode.SUCCESS.getValue(),
                        "Failed");
                break;
            case EXCEPTION:
                ret = new ApiResponse(
                        ECode.EXCEPTION.getValue(),
                        "Exception");
                break;
            case ALREADY_EXISTS_USERNAME:
                ret = new ApiResponse(
                        ECode.ALREADY_EXISTS_USERNAME.getValue(),
                        "Already exists username");
                break;
            case INVALID_USERNAME_OR_PASSWORD:
                ret = new ApiResponse(
                        ECode.INVALID_USERNAME_OR_PASSWORD.getValue(),
                        "Invalid username or password");
                break;
            case NOT_EXISTS_ROOM:
                ret = new ApiResponse(
                        ECode.NOT_EXISTS_ROOM.getValue(),
                        "Not exists room");
                break;
            case INVALID_SESSION:
                ret = new ApiResponse(
                        ECode.INVALID_SESSION.getValue(),
                        "Invalid session");
                break;
        }
        return ret;
    }
}
