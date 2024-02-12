package com.example.demo.model.persistence.repositories;

import com.example.demo.model.persistence.File;
import com.example.demo.model.persistence.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Transactional
public interface FileRepository extends JpaRepository<File, Long> {
    @Query(value = "SELECT name FROM FILES WHERE userid= :userId ", nativeQuery = true)
    String[] getFilesListByUserId(
            @Param("userId") long userId
    );

    public List<File> findByUserid(Long user);
}
