package com.example.demo.controllers;

import com.example.demo.content.FileContentService;
import com.example.demo.content.FileUploadResult;
import com.example.demo.model.persistence.File;
import com.example.demo.security.CloudappAccessPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/file")
public class FileController {

    @Autowired
    private CloudappAccessPolicy cloudappAccessPolicy;

    @Autowired
    private FileContentService fileContentService;

    @GetMapping("/user/{username}")
    public ResponseEntity<List<File>> getNotes(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return fileContentService.findFilesForUsername(username)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
    @GetMapping(
            value = "/get-file/{fileId}",
            produces = MediaType.APPLICATION_OCTET_STREAM_VALUE
    )
    public ResponseEntity<byte[]> getFile(@PathVariable Long fileId, Authentication auth, HttpServletRequest request) {
        Optional<File> file = fileContentService.findFileById(fileId);
        if (file.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, file.get().getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.get().getFileName() + "\"")
                .body(file.get().getFileData());
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("fileUpload") MultipartFile file,
            @RequestParam("username") String username,
            Authentication auth,
            HttpServletRequest request) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        FileUploadResult result = fileContentService.storeFile(username, file);
        if (result.status() == FileUploadResult.Status.USER_NOT_FOUND) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (result.status() == FileUploadResult.Status.IO_ERROR) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        if (result.status() != FileUploadResult.Status.SUCCESS) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/delete-file/{fileId}")
    public ResponseEntity<?> deleteFile(@PathVariable Long fileId, Authentication auth, HttpServletRequest request) {
        Optional<File> file = fileContentService.findFileById(fileId);
        if (file.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, file.get().getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        fileContentService.deleteFile(file.get());
        return ResponseEntity.ok().build();
    }
}
