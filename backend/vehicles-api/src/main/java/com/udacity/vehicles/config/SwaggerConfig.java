package com.udacity.vehicles.config;


import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI api() {
        return new OpenAPI()
                .info(apiInfo());
    }

    private Info apiInfo() {
        return new Info()
                .title("Vehicle REST API")
                .description("This API returns a vehicle info.")
                .version("v1.0")
                .contact(new Contact().name("Udacious Student").url("www.udacity.com").email("myeaddress@udacity.com"))
                .license(new License()
                        .name("License of API")
                        .url("http://www.udacity.com/license"));
    }

}