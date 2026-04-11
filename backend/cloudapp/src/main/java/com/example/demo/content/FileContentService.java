package com.example.demo.content;

import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.FileRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Service
public class FileContentService {

    private static final Logger log = LoggerFactory.getLogger(FileContentService.class);
    private static final long MAX_FILE_SIZE_BYTES = 2_000_000L;

    private final FileRepository fileRepository;
    private final UserRepository userRepository;

    public FileContentService(FileRepository fileRepository, UserRepository userRepository) {
        this.fileRepository = fileRepository;
        this.userRepository = userRepository;
    }

    public Optional<List<File>> findFilesForUsername(String username) {
        return findUser(username)
                .map(user -> fileRepository.findByUserid(user.getId()));
    }

    public Optional<File> findFileById(Long fileId) {
        return fileRepository.findById(fileId);
    }

    public FileUploadResult storeFile(String username, MultipartFile upload) {
        Optional<User> user = findUser(username);
        if (user.isEmpty()) {
            return FileUploadResult.failure(FileUploadResult.Status.USER_NOT_FOUND);
        }
        if (upload == null || upload.isEmpty()) {
            return FileUploadResult.failure(FileUploadResult.Status.EMPTY_FILE);
        }
        if (upload.getSize() > MAX_FILE_SIZE_BYTES) {
            return FileUploadResult.failure(FileUploadResult.Status.FILE_TOO_LARGE);
        }

        String originalFilename = upload.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return FileUploadResult.failure(FileUploadResult.Status.INVALID_FILE_NAME);
        }

        String[] existingFileNames = fileRepository.getFilesListByUserId(user.get().getId());
        for (String existingFileName : existingFileNames) {
            if (originalFilename.equals(existingFileName)) {
                return FileUploadResult.failure(FileUploadResult.Status.DUPLICATE_FILE);
            }
        }

        try {
            File saved = fileRepository.save(new File(
                    originalFilename,
                    upload.getContentType(),
                    String.valueOf(upload.getSize()),
                    user.get().getId(),
                    upload.getBytes()
            ));
            return FileUploadResult.success(saved);
        } catch (IOException e) {
            log.error("Failed to store uploaded file {} for user {}", originalFilename, username, e);
            return FileUploadResult.failure(FileUploadResult.Status.IO_ERROR);
        }
    }

    public void deleteFile(File file) {
        fileRepository.delete(file);
    }

    private Optional<User> findUser(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(userRepository.findByUsername(username));
    }
}
