package com.example.demo.content;

import com.example.demo.model.persistence.Note;
import com.example.demo.model.persistence.User;
import com.example.demo.model.persistence.repositories.NoteRepository;
import com.example.demo.model.persistence.repositories.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class NoteContentService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    public NoteContentService(NoteRepository noteRepository, UserRepository userRepository) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
    }

    public Optional<List<Note>> findNotesForUsername(String username) {
        return findUser(username)
                .map(user -> noteRepository.findByUserid(user.getId()));
    }

    public Optional<Note> createNote(String username, String title, String description) {
        return findUser(username)
                .map(user -> noteRepository.save(new Note(title, description, user.getId())));
    }

    public Optional<Note> findNoteById(Long id) {
        return noteRepository.findById(id);
    }

    public Note updateNote(Note existingNote, String title, String description) {
        existingNote.setTitle(title);
        existingNote.setDescription(description);
        return noteRepository.save(existingNote);
    }

    public void deleteNote(Note note) {
        noteRepository.delete(note);
    }

    private Optional<User> findUser(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(userRepository.findByUsername(username));
    }
}
