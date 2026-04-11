package com.example.demo.controllers;

import com.example.demo.model.persistence.Note;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.NoteRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.model.requests.CreateNoteRequest;
import com.example.demo.model.requests.UpdateNoteRequest;
import com.example.demo.security.CloudappAccessPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/note")
public class NoteController {
    @Autowired
    public NoteRepository noteRepository;

    @Autowired
    public UserRepository userRepository;

    @Autowired
    private CloudappAccessPolicy cloudappAccessPolicy;

    @GetMapping("/user/{username}")
    public ResponseEntity<List<Note>> getNotes(
            @PathVariable String username,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, username)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(noteRepository.findByUserid(user.getId().longValue()));
    }
    @PostMapping("/addNote")
    public ResponseEntity<Note> insertOrUpdateNote(
            @RequestBody CreateNoteRequest note,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (note.getUser() == null || note.getTitle() == null || note.getDescription() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (!cloudappAccessPolicy.canAccessUsername(auth, request, note.getUser())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (note.getDescription().length() < 1000) {
            User user = userRepository.findByUsername(note.getUser());
            if (user == null) {
                return ResponseEntity.notFound().build();
            }
            Note newNote = new Note(note.getTitle(), note.getDescription(), user.getId());
            Note noteResponse = noteRepository.save(newNote);
            return ResponseEntity.of(noteRepository.findById(noteResponse.getId()));
        } else {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/updateNote")
    public ResponseEntity<Note> insertOrUpdateNote(
            @RequestBody UpdateNoteRequest noteRequest,
            Authentication auth,
            HttpServletRequest request
    ) {
        if (noteRequest.getId() == null || noteRequest.getTitle() == null || noteRequest.getDescription() == null) {
            return ResponseEntity.badRequest().build();
        }

        Note existingNote = noteRepository.findById(noteRequest.getId()).orElse(null);
        if (existingNote == null) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, existingNote.getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (noteRequest.getDescription().length() < 1000) {
            existingNote.setTitle(noteRequest.getTitle());
            existingNote.setDescription(noteRequest.getDescription());
            Note saved = noteRepository.save(existingNote);
            return ResponseEntity.ok(saved);
        } else {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping(value = "/delete/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable Long id, Authentication auth, HttpServletRequest request) {
        Note existingNote = noteRepository.findById(id).orElse(null);
        if (existingNote == null) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, existingNote.getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        noteRepository.deleteById(id);
        return  ResponseEntity.ok().build();
    }
}
