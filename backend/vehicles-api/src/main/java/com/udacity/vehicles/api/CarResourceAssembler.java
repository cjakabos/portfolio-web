package com.udacity.vehicles.api;

import com.udacity.vehicles.domain.car.Car;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.server.RepresentationModelAssembler;
import org.springframework.stereotype.Component;

import static org.springframework.hateoas.server.mvc.WebMvcLinkBuilder.*;

/**
 * Maps the CarController to the Car class using HATEOAS
 */
@Component
public class CarResourceAssembler implements RepresentationModelAssembler<Car, EntityModel<Car>> {


    @Override
    public EntityModel<Car> toModel(Car car) {

        EntityModel<Car> resource = EntityModel.of(car);

        resource.add(linkTo(methodOn(CarController.class).get(car.getId())).withSelfRel());
        resource.add(linkTo(methodOn(CarController.class).list()).withRel("cars"));

        return resource;
    }
}
