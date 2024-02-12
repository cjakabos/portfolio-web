package com.example.demo.controllers;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.Note;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.ItemRepository;
import com.example.demo.model.persistence.repositories.NoteRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import com.example.demo.model.requests.CreateNoteRequest;
import com.example.demo.model.requests.ModifyCartRequest;
import com.example.demo.model.requests.UpdateNoteRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = "http://localhost:5001")
@RestController
@RequestMapping("/note")
public class NoteController {
    @Autowired
    public NoteRepository noteRepository;

    @Autowired
    public UserRepository userRepository;

    @GetMapping("/user/{username}")
    public ResponseEntity<List<Note>> getNotes(@PathVariable String username) {
        User user = userRepository.findByUsername(username);
        return ResponseEntity.ok(noteRepository.findByUserid(user.getId().longValue()));
    }
    @PostMapping("/addNote")
    public ResponseEntity<Note> insertOrUpdateNote(@RequestBody CreateNoteRequest note) {
        if (note.getDescription().length() < 1000) {
            User user = userRepository.findByUsername(note.getUser());
            Note newNote = new Note(note.getTitle(), note.getDescription(), user.getId());
            Note noteResponse = noteRepository.save(newNote);
            return ResponseEntity.of(noteRepository.findById(noteResponse.getId()));
        } else {
            String userFeedback = "Longer note than 1000 characters not allowed";
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/updateNote")
    public ResponseEntity<Note> insertOrUpdateNote(@RequestBody UpdateNoteRequest noteRequest) {
        if (noteRequest.getDescription().length() < 1000) {
            noteRepository.updateNote(
                    noteRequest.getId(),
                    noteRequest.getTitle(),
                    noteRequest.getDescription()
            );
            return ResponseEntity.of(noteRepository.findById(noteRequest.getId()));
        } else {
            String userFeedback = "Longer note than 1000 characters not allowed";
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping(value = "/delete/{id}")
    public ResponseEntity deleteNote(@PathVariable Long id) {
        noteRepository.deleteById(id);
        return  ResponseEntity.ok().build();
    }
}
