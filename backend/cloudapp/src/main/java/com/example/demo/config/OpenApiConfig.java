package com.example.demo.config;

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
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {

        SecurityScheme securityScheme = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT");

        return new OpenAPI()
                .info(new Info()
                        .title("Cloudapp API")
                        .version("v0.01")
                        .description("Documentation Cloudapp API v0.01: Bearer token is received via user-controller /api/user/login endpoint")
                        .termsOfService("http://swagger.io/terms/")
                        .license(new License()
                                .name("Apache 2.0")
                                .url("http://www.apache.org/licenses/"))
                        .contact(new Contact()
                                .name("DEMO")
                                .url("https://exxxxxxxample.vercel.app/"))
                )
                .components(new Components().addSecuritySchemes("Bearer token", securityScheme))
                .addSecurityItem(new SecurityRequirement().addList("Bearer token"));
    }

}

