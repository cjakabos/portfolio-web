package com.udacity.jwdnd.course1.cloudinterface.mappers;

import com.udacity.jwdnd.course1.cloudinterface.entity.File;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FileMapper {
    @Select("SELECT filename FROM FILES WHERE userId=#{userId}")
    String[] getFilesListByUserId(int userId);

    @Select("SELECT * FROM FILES WHERE filename=#{filename}")
    File getFileByName(String fileName);

    @Insert("INSERT INTO FILES (filename, contenttype, filesize, userid, filedata) " +
            "VALUES (#{fileName}, #{contentType}, #{fileSize}, #{userId}, #{fileData})")
    @Options(useGeneratedKeys = true, keyProperty = "fileId")
    void addFile(File file);

    @Delete("DELETE FROM FILES WHERE fileName = #{fileName}")
    void deleteFile(String fileName);
}
