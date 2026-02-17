package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.FileRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FileControllerTest {

    private FileController fileController;
    private FileRepository fileRepository;
    private UserRepository userRepository;

    @BeforeEach
    void setup() {
        fileController = new FileController();
        fileRepository = mock(FileRepository.class);
        userRepository = mock(UserRepository.class);
        TestUtils.injectObjects(fileController, "fileRepository", fileRepository);
        TestUtils.injectObjects(fileController, "userRepository", userRepository);
    }

    @Test
    void getNotes_happyPath() {
        User user = new User();
        user.setId(10L);
        when(userRepository.findByUsername("alice")).thenReturn(user);
        when(fileRepository.findByUserid(10L)).thenReturn(List.of(new File()));

        ResponseEntity<List<File>> resp = fileController.getNotes("alice");
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals(1, resp.getBody().size());
    }

    @Test
    void getFile_happyPath() {
        byte[] payload = "hello".getBytes(StandardCharsets.UTF_8);
        File file = new File("greeting.txt", "text/plain", "5", 1L, payload);
        when(fileRepository.findById(11L)).thenReturn(Optional.of(file));

        byte[] data = fileController.getFile(11L);
        assertArrayEquals(payload, data);
    }

    @Test
    void uploadFile_userNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(null);
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "a.txt",
                "text/plain",
                "abc".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity resp = fileController.uploadFile(file, "ghost");
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
        verify(fileRepository, never()).save(any(File.class));
    }

    @Test
    void uploadFile_duplicateName() {
        User user = new User();
        user.setId(2L);
        when(userRepository.findByUsername("alice")).thenReturn(user);
        when(fileRepository.getFilesListByUserId(2L)).thenReturn(new String[]{"dup.txt"});
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "dup.txt",
                "text/plain",
                "abc".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity resp = fileController.uploadFile(file, "alice");
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        verify(fileRepository, never()).save(any(File.class));
    }

    @Test
    void uploadFile_happyPath() {
        User user = new User();
        user.setId(3L);
        when(userRepository.findByUsername("alice")).thenReturn(user);
        when(fileRepository.getFilesListByUserId(3L)).thenReturn(new String[0]);
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "ok.txt",
                "text/plain",
                "hello".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity resp = fileController.uploadFile(file, "alice");
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(fileRepository, times(1)).save(any(File.class));
    }

    @Test
    void deleteFile_happyPath() {
        ResponseEntity resp = fileController.deleteFile(99L);
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(fileRepository, times(1)).deleteById(99L);
    }
}
