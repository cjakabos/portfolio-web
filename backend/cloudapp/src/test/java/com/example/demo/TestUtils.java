package com.example.demo;

import java.lang.reflect.Field;

public class TestUtils {

    public static void injectObjects(Object target, String fieldName, Object toInject) {

        boolean changedAccess = false;

        try {
            Field f = target.getClass().getDeclaredField(fieldName);
            if (!f.canAccess(target)) {
                f.setAccessible(true);
                changedAccess = true;
            }
            f.set(target, toInject);

            if (changedAccess) {
                f.setAccessible(false);
            }
        } catch (NoSuchFieldException e) {
            e.printStackTrace();
        } catch (IllegalAccessException e) {
            e.printStackTrace();
        }
    }
}
