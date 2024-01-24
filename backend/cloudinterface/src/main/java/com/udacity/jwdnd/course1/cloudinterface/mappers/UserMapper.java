package com.udacity.jwdnd.course1.cloudinterface.mappers;

import com.udacity.jwdnd.course1.cloudinterface.entity.User;
import org.apache.ibatis.annotations.*;


@Mapper
public interface UserMapper {
    @Select("SELECT * FROM USERS WHERE username = #{username}")
    User getUser(String username);

    @Select("SELECT * FROM USERS WHERE userId = #{userId}")
    User getUserByUserId(Integer userId);

    @Insert("INSERT INTO USERS (username,salt,password,firstname,lastname)" +
            "VALUES (#{username}, #{salt}, #{password}, #{firstname}, #{lastname})")
    @Options(useGeneratedKeys = true, keyProperty = "userId")
    int insert(User user);
}
