package com.example.demo.model.persistence.repositories;

import com.example.demo.model.persistence.Item;
import com.example.demo.model.persistence.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
@Transactional
public interface NoteRepository extends JpaRepository<Note, Long> {
    @Modifying
    @Query(value = "UPDATE notes SET title= :title, description= :description WHERE id = :id", nativeQuery = true)
    void updateNote(
            @Param("id") Long id,
            @Param("title") String title,
            @Param("description") String description
    );

    public List<Note> findByUserid(Long user);
}
