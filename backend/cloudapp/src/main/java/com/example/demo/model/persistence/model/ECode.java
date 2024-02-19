package com.example.demo.model.persistence.model;

import lombok.Getter;


@Getter
public enum ECode {
    SUCCESS(0),
    FAILED(1),
    EXCEPTION(2),
    ALREADY_EXISTS_USERNAME(3),
    INVALID_USERNAME_OR_PASSWORD(4),
    NOT_EXISTS_ROOM(5),
    INVALID_SESSION(6),
    NOT_DEFINED(10);

    private int value;

    private ECode(int value) {
        this.value = value;
    }

    public ECode findByValye(int value) {
        int ecode = Math.abs(value);
        switch (ecode) {
            case 0:
                return SUCCESS;
            case 1:
                return FAILED;
        }
        return NOT_DEFINED;
    }

    public static boolean isFailed(ECode ecode) {
        return ecode != ECode.SUCCESS;
    }
}
