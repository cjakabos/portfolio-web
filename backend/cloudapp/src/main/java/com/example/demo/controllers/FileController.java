package com.example.demo.controllers;

import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.FileRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/file")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);

    @Autowired
    public FileRepository fileRepository;
    @Autowired
    public UserRepository userRepository;

    @GetMapping("/user/{username}")
    public ResponseEntity<List<File>> getNotes(@PathVariable String username, Authentication auth) {
        String authenticated = getAuthenticatedUsername(auth);
        if (authenticated == null || !authenticated.equals(username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        User user = userRepository.findByUsername(username);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(fileRepository.findByUserid(user.getId()));
    }
    @GetMapping(
            value = "/get-file/{fileId}",
            produces = MediaType.APPLICATION_OCTET_STREAM_VALUE
    )
    public ResponseEntity<byte[]> getFile(@PathVariable Long fileId, Authentication auth) {
        String authenticated = getAuthenticatedUsername(auth);
        if (authenticated == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<File> file = fileRepository.findById(fileId);
        if (file.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User authenticatedUser = userRepository.findByUsername(authenticated);
        if (authenticatedUser == null || !authenticatedUser.getId().equals(file.get().getUserid())) {
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
            Authentication auth) {
        String authenticated = getAuthenticatedUsername(auth);
        if (authenticated == null || !authenticated.equals(username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        boolean isError = false;

        Optional<User> user = Optional.ofNullable(userRepository.findByUsername(username));
        if (!user.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        String[] filesList = fileRepository.getFilesListByUserId(user.get().getId());

        if (file.getSize() > 2000000) {
            isError = true;
        }

        if (file.isEmpty()) {
            isError = true;
        } else {
            for (String fileName : filesList) {
                if (file.getSize() > 2000000) {
                    isError = true;
                } else if (file.getOriginalFilename().equals(fileName)) {
                    isError = true;
                }
            }
        }
        if (!isError && !file.isEmpty()) {

            try {
                File newFile = new File(
                        file.getOriginalFilename(),
                        file.getContentType(),
                        String.valueOf(file.getSize()),
                        user.get().getId(),
                        file.getBytes());
                fileRepository.save(newFile);
            } catch (IOException e) {
                log.error("Failed to upload file for user {}", username, e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }

        } else {
            return ResponseEntity.badRequest().build();
        }


        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/delete-file/{fileId}")
    public ResponseEntity<?> deleteFile(@PathVariable Long fileId, Authentication auth) {
        String authenticated = getAuthenticatedUsername(auth);
        if (authenticated == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<File> file = fileRepository.findById(fileId);
        if (file.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User authenticatedUser = userRepository.findByUsername(authenticated);
        if (authenticatedUser == null || !authenticatedUser.getId().equals(file.get().getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        fileRepository.deleteById(fileId);
        return ResponseEntity.ok().build();
    }

    private String getAuthenticatedUsername(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof User user) {
            return user.getUsername();
        }
        if (principal instanceof org.springframework.security.core.userdetails.User springUser) {
            return springUser.getUsername();
        }
        return null;
    }

}
