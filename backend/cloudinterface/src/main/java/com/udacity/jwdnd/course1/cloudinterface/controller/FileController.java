package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.udacity.jwdnd.course1.cloudinterface.services.FileService;
import com.udacity.jwdnd.course1.cloudinterface.services.UserService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Controller
@RequestMapping("/file")
public class FileController {
    private FileService fService;
    private UserService uService;

    public FileController(FileService fService, UserService uService) {
        this.fService = fService;
        this.uService = uService;
    }

    @GetMapping(
            value = "/get-file/{fileName}",
            produces = MediaType.APPLICATION_OCTET_STREAM_VALUE
    )

    public @ResponseBody
    byte[] getFile(@PathVariable String fileName) {
        return fService.getFileByName(fileName).getFileData();
    }

    @PostMapping("/upload")
    public String uploadFile(Authentication authentication, @RequestParam("fileUpload") MultipartFile file, Model model) {
        String feedbackHandler = "updateError";
        String messageType = null;
        boolean isError = false;

        Integer userId = uService.getUserByUsername(authentication.getName()).getUserId();
        String[] filesList = fService.getFilesListByUserId(userId);

        if (file.getSize() > 2000000) {
            isError = true;
            messageType = "File can't be greater than 2MB. Choose a smaller file.";
            feedbackHandler = "updateError";
        }

        if (file.isEmpty()) {
            isError = true;
            messageType = "File is empty";
            feedbackHandler = "updateError";
        } else {
            for (String fileName : filesList) {
                if (file.getSize() > 2000000) {
                    isError = true;
                    messageType = "File can't be greater than 2MB. Choose a smaller file.";
                } else if (file.getOriginalFilename().equals(fileName)) {
                    isError = true;
                    messageType = "Filename can't be the same as an existing one.";
                }
            }
        }
        if (!isError && !file.isEmpty()) {
            boolean success = fService.uploadFile(file, userId);
            if (success == true) {
                messageType = "Uploaded!";
                feedbackHandler = "updateSuccess";
            } else {
                messageType = "Fail while uploading";
                feedbackHandler = "updateError";
            }
        }

        model.addAttribute(feedbackHandler, messageType);

        return "result";
    }

    @GetMapping("/delete-file/{fileName}")
    public String deleteFile(@PathVariable String fileName, Model model) {
        String feedbackHandler = "updateError";
        String messageType = null;

        fService.deleteFile(fileName);
        messageType = "Deleted!";
        feedbackHandler = "updateSuccess";

        model.addAttribute(feedbackHandler, messageType);
        return "result";
    }


}
