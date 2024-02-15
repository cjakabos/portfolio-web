package com.example.demo.model.persistence;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;

@Entity
@Table(name = "files")
public class File {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false)
    @JsonProperty
    private Long id;
    @Column(nullable = false)
    @JsonProperty
    private String name;
    @Column(nullable = false)
    @JsonProperty
    private String contentType;
    @Column(nullable = false)
    @JsonProperty
    private String fileSize;
    @Column(nullable = false)
    @JsonProperty
    private Long userid;
    @Column(nullable = false)
    @JsonProperty
    private byte[] fileData;

    public File() {
    }

    public File(Long id, String name, String fileContentType, String fileSize, Long userid, byte[] fileData) {
        this.id = id;
        this.name = name;
        this.contentType = fileContentType;
        this.fileSize = fileSize;
        this.userid = userid;
        this.fileData = fileData;
    }

    public File(String name, String fileContentType, String fileSize, Long userid, byte[] fileData) {
        this.name = name;
        this.contentType = fileContentType;
        this.fileSize = fileSize;
        this.userid = userid;
        this.fileData = fileData;
    }

    public Long getFileId() {
        return id;
    }

    public void setFileId(Long fileId) {
        this.id = fileId;
    }

    public String getFileName() {
        return name;
    }

    public void setFileName(String fileName) {
        this.name = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String fileContentType) {
        this.contentType = fileContentType;
    }

    public String getFileSize() {
        return fileSize;
    }

    public void setFileSize(String fileSize) {
        this.fileSize = fileSize;
    }

    public Long getUserid() {
        return userid;
    }

    public void setUserid(Long userid) {
        this.userid = userid;
    }

    public byte[] getFileData() {
        return fileData;
    }

    public void setFileData(byte[] fileData) {
        this.fileData = fileData;
    }
}
