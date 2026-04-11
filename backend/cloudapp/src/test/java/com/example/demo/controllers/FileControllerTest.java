package com.example.demo.controllers;

import com.example.demo.TestUtils;
import com.example.demo.content.FileContentService;
import com.example.demo.content.FileUploadResult;
import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.User;
import com.example.demo.security.CloudappAccessPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class FileControllerTest {

    private FileController fileController;
    private FileContentService fileContentService;
    private CloudappAccessPolicy cloudappAccessPolicy;

    private Authentication authFor(String username, Long userId) {
        return new UsernamePasswordAuthenticationToken(
                new User(userId, username, "hashed"),
                null,
                Collections.emptyList()
        );
    }

    @BeforeEach
    void setup() {
        fileController = new FileController();
        fileContentService = mock(FileContentService.class);
        cloudappAccessPolicy = mock(CloudappAccessPolicy.class);
        TestUtils.injectObjects(fileController, "fileContentService", fileContentService);
        TestUtils.injectObjects(fileController, "cloudappAccessPolicy", cloudappAccessPolicy);
        when(cloudappAccessPolicy.canAccessUsername(any(), any(), anyString())).thenReturn(true);
        when(cloudappAccessPolicy.canAccessUserId(any(), any(), anyLong())).thenReturn(true);
    }

    @Test
    void getNotes_happyPath() {
        when(fileContentService.findFilesForUsername("alice")).thenReturn(Optional.of(List.of(new File())));

        ResponseEntity<List<File>> resp = fileController.getNotes("alice", authFor("alice", 10L), new MockHttpServletRequest());
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals(1, resp.getBody().size());
    }

    @Test
    void getFile_happyPath() {
        byte[] payload = "hello".getBytes(StandardCharsets.UTF_8);
        File file = new File("greeting.txt", "text/plain", "5", 1L, payload);
        when(fileContentService.findFileById(11L)).thenReturn(Optional.of(file));

        ResponseEntity<byte[]> response = fileController.getFile(11L, authFor("alice", 1L), new MockHttpServletRequest());
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertArrayEquals(payload, response.getBody());
    }

    @Test
    void uploadFile_userNotFound() {
        when(fileContentService.storeFile(eq("ghost"), any())).thenReturn(
                FileUploadResult.failure(FileUploadResult.Status.USER_NOT_FOUND)
        );
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "a.txt",
                "text/plain",
                "abc".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity<?> resp = fileController.uploadFile(file, "ghost", authFor("ghost", 99L), new MockHttpServletRequest());
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
        verify(fileContentService).storeFile("ghost", file);
    }

    @Test
    void uploadFile_duplicateName() {
        when(fileContentService.storeFile(eq("alice"), any())).thenReturn(
                FileUploadResult.failure(FileUploadResult.Status.DUPLICATE_FILE)
        );
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "dup.txt",
                "text/plain",
                "abc".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity<?> resp = fileController.uploadFile(file, "alice", authFor("alice", 2L), new MockHttpServletRequest());
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        verify(fileContentService).storeFile("alice", file);
    }

    @Test
    void uploadFile_happyPath() {
        File storedFile = new File("ok.txt", "text/plain", "5", 3L, "hello".getBytes(StandardCharsets.UTF_8));
        when(fileContentService.storeFile(eq("alice"), any())).thenReturn(FileUploadResult.success(storedFile));
        MockMultipartFile file = new MockMultipartFile(
                "fileUpload",
                "ok.txt",
                "text/plain",
                "hello".getBytes(StandardCharsets.UTF_8)
        );

        ResponseEntity<?> resp = fileController.uploadFile(file, "alice", authFor("alice", 3L), new MockHttpServletRequest());
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(fileContentService).storeFile("alice", file);
    }

    @Test
    void deleteFile_happyPath() {
        File file = new File("x.txt", "text/plain", "1", 4L, "x".getBytes(StandardCharsets.UTF_8));
        when(fileContentService.findFileById(99L)).thenReturn(Optional.of(file));

        ResponseEntity<?> resp = fileController.deleteFile(99L, authFor("alice", 4L), new MockHttpServletRequest());
        assertEquals(HttpStatus.OK, resp.getStatusCode());
        verify(fileContentService).deleteFile(file);
    }
}
