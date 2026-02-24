package com.udacity.jdnd.course3.petstore;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI petstoreOpenAPI() {
        return new OpenAPI()
                .components(new Components())
                .info(new Info()
                        .title("Petstore API")
                        .description("Pet scheduling and customer/employee management API")
                        .version("v1")
                        .contact(new Contact()
                                .name("Portfolio Web")
                                .url("https://github.com/csaba"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")));
    }
}
