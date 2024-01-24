package com.udacity.jwdnd.course1.cloudinterface.services;

import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.mappers.NoteMapper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NoteService {
    private NoteMapper noteMapper;
    private UserService userService;


    public NoteService(NoteMapper noteMapper, UserService userService) {
        this.noteMapper = noteMapper;
        this.userService = userService;
    }

    public List<Note> getNotesByUserId(Integer userId) {
        return noteMapper.getNotesByUserId(userId);
    }

    public boolean insertOrUpdateNote(Note newNote, String username) {
        Integer userId = userService.getUserByUsername(username).getUserId();

        if (newNote.getNoteId() == null) {
            Note note = new Note();
            note.setUserId(userId);
            note.setNoteTitle(newNote.getNoteTitle());
            note.setNoteDescription(newNote.getNoteDescription());
            noteMapper.addNote(note);
        } else {
            noteMapper.updateNote(newNote.getNoteId(), newNote.getNoteTitle(), newNote.getNoteDescription());
        }
        return true;
    }

    public boolean deleteNote(Integer noteId) {
        noteMapper.deleteNote(noteId);
        return true;
    }
}
