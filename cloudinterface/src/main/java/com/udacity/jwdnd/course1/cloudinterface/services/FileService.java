package com.udacity.jwdnd.course1.cloudinterface.services;

import com.udacity.jwdnd.course1.cloudinterface.entity.File;
import com.udacity.jwdnd.course1.cloudinterface.mappers.FileMapper;
import com.udacity.jwdnd.course1.cloudinterface.mappers.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
public class FileService {
    private FileMapper fileMapper;

    public FileService(FileMapper fileMapper, UserMapper userMapper) {
        this.fileMapper = fileMapper;
    }

    public String[] getFilesListByUserId(Integer userId) {
        return fileMapper.getFilesListByUserId(userId);
    }

    public File getFileByName(String fileName) {
        return fileMapper.getFileByName(fileName);
    }

    public boolean uploadFile(MultipartFile multipartFile, Integer userId) {
        File newFile = new File();
        try {
            String fileName = multipartFile.getOriginalFilename();
            byte[] bytes = multipartFile.getBytes();
            String contentType = multipartFile.getContentType();
            String fileSize = String.valueOf(multipartFile.getSize());

            newFile.setUserId(userId);
            newFile.setFileName(fileName);
            newFile.setContentType(contentType);
            newFile.setFileData(bytes);
            newFile.setFileSize(fileSize);

            fileMapper.addFile(newFile);
        } catch (IOException e) {
            e.printStackTrace();
        }

        return true;
    }

    public boolean deleteFile(String fileName) {
        fileMapper.deleteFile(fileName);
        return true;
    }
}
