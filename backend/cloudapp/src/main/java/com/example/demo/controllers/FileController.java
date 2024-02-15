package com.example.demo.controllers;

import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.Note;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.FileRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = "http://localhost:5001")
@RestController
@RequestMapping("/file")
public class FileController {
    @Autowired
    public FileRepository fileRepository;
    @Autowired
    public UserRepository userRepository;

    @GetMapping("/user/{username}")
    public ResponseEntity<List<File>> getNotes(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        return ResponseEntity.ok(fileRepository.findByUserid(user.getId()));
    }
    @GetMapping(
            value = "/get-file/{fileId}",
            produces = MediaType.APPLICATION_OCTET_STREAM_VALUE
    )
    public @ResponseBody
    byte[] getFile(@PathVariable Long fileId) {
        return fileRepository.findById(fileId).get().getFileData();
    }

    @PostMapping("/upload")
    public ResponseEntity uploadFile(@RequestParam("fileUpload") MultipartFile file, @RequestParam("username") String username) {
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
                e.printStackTrace();
            }

        } else {
            return ResponseEntity.badRequest().build();
        }


        return ResponseEntity.ok().build();
    }

    @GetMapping("/delete-file/{fileId}")
    public ResponseEntity deleteFile(@PathVariable Long fileId) {
        fileRepository.deleteById(fileId);
        return ResponseEntity.ok().build();
    }


}
