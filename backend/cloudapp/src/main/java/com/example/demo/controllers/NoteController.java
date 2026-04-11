package com.example.demo.controllers;

import com.example.demo.content.NoteContentService;
import com.example.demo.model.persistence.Note;
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
    private NoteContentService noteContentService;

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
        return noteContentService.findNotesForUsername(username)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
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
            return noteContentService.createNote(note.getUser(), note.getTitle(), note.getDescription())
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
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

        Note existingNote = noteContentService.findNoteById(noteRequest.getId()).orElse(null);
        if (existingNote == null) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, existingNote.getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (noteRequest.getDescription().length() < 1000) {
            return ResponseEntity.ok(
                    noteContentService.updateNote(existingNote, noteRequest.getTitle(), noteRequest.getDescription())
            );
        } else {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping(value = "/delete/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable Long id, Authentication auth, HttpServletRequest request) {
        Note existingNote = noteContentService.findNoteById(id).orElse(null);
        if (existingNote == null) {
            return ResponseEntity.notFound().build();
        }

        if (!cloudappAccessPolicy.canAccessUserId(auth, request, existingNote.getUserid())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        noteContentService.deleteNote(existingNote);
        return  ResponseEntity.ok().build();
    }
}
