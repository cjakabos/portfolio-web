package com.example.demo.content;

import com.example.demo.model.persistence.File;

public record FileUploadResult(Status status, File file) {

    public static FileUploadResult success(File file) {
        return new FileUploadResult(Status.SUCCESS, file);
    }

    public static FileUploadResult failure(Status status) {
        return new FileUploadResult(status, null);
    }

    public enum Status {
        SUCCESS,
        USER_NOT_FOUND,
        EMPTY_FILE,
        FILE_TOO_LARGE,
        DUPLICATE_FILE,
        INVALID_FILE_NAME,
        IO_ERROR
    }
}
