package com.udacity.jwdnd.course1.cloudinterface.mappers;

import com.udacity.jwdnd.course1.cloudinterface.entity.Note;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface NoteMapper {
    @Select("SELECT * FROM NOTES WHERE userId=#{userId}")
    List<Note> getNotesByUserId(Integer userId);

    @Insert("INSERT INTO NOTES (notetitle, notedescription, userid) VALUES (#{noteTitle}, #{noteDescription}, #{userId})")
    @Options(useGeneratedKeys = true, keyProperty = "noteId")
    void addNote(Note note);

    @Update("UPDATE NOTES SET noteTitle=#{noteTitle}, noteDescription=#{noteDescription} WHERE noteId = #{noteId}")
    void updateNote(Integer noteId, String noteTitle, String noteDescription);

    @Delete("DELETE FROM NOTES WHERE noteId =#{noteId}")
    void deleteNote(int noteId);
}
