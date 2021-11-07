package com.udacity.jwdnd.course1.cloudinterface.controller;

import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import com.udacity.jwdnd.course1.cloudinterface.services.NoteService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/note")
public class NoteController {
    private NoteService nService;

    public NoteController(NoteService nService) {
        this.nService = nService;
    }

    @PostMapping("/addNote")
    public String insertOrUpdateNote(Authentication authentication,
                                     @ModelAttribute("newNote") Note note,
                                     Model model) {
        if (note.getNoteDescription().length() < 1000) {
            String userFeedback = "Success";
            String username = authentication.getName();
            nService.insertOrUpdateNote(note, username);
            model.addAttribute("updateSuccess", userFeedback);
        } else {
            String userFeedback = "Longer note than 1000 characters not allowed";
            model.addAttribute("updateError", userFeedback);
        }

        return "result";
    }

    @GetMapping(value = "/delete/{noteId}")
    public String deleteNote(@PathVariable Integer noteId,
                             Model model) {
        String userFeedback = "Success";
        nService.deleteNote(noteId);
        model.addAttribute("updateSuccess", userFeedback);
        return "result";
    }
}
