package com.udacity.jdnd.course3.petstore.pet;

import com.udacity.jdnd.course3.petstore.entity.*;
import com.udacity.jdnd.course3.petstore.service.*;

import com.udacity.jdnd.course3.petstore.user.CustomerDTO;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles web requests related to Pets.
 */
@CrossOrigin(origins = {
        "http://localhost:5001",
        "https://localhost:5001",
        "http://localhost:5006",
        "https://localhost:5006",
        "http://localhost:80",
        "https://localhost:80"
})
@RestController
@RequestMapping("/pet")
public class PetController {

    @Autowired
    private PetService petService;

    @PostMapping
    public PetDTO savePet(@RequestBody PetDTO petDTO) {
        Pet pet = new Pet();
        pet.setPetType(petDTO.getType());
        pet.setName(petDTO.getName());
        pet.setBirthDate(petDTO.getBirthDate());
        pet.setNotes(petDTO.getNotes());
        System.out.println("Here i am");
        pet = petService.savePet(pet, petDTO.getOwnerId());
        return petToPetDTO(pet);
    }

    @PutMapping("/{petId}")
    public PetDTO updatePet(@PathVariable Long petId, @RequestBody PetDTO petDTO) {
        Pet pet = petService.getPet(petId);
        pet.setPetType(petDTO.getType());
        pet.setName(petDTO.getName());
        pet.setBirthDate(petDTO.getBirthDate());
        pet.setNotes(petDTO.getNotes());
        pet = petService.savePet(pet, petDTO.getOwnerId());
        return petToPetDTO(pet);
    }

    @GetMapping("/{petId}")
    public PetDTO getPet(@PathVariable long petId) {
        Pet pet = petService.getPet(petId);
        PetDTO petDto = petToPetDTO(pet);
        BeanUtils.copyProperties(pet, petDto);
        petDto.setOwnerId(pet.getCustomer().getId());
        return petDto;
    }

    @DeleteMapping("/{id}")
    public void deletePet(@PathVariable Long id) {
        petService.deletePet(id);
    }

    @GetMapping("/owner/{ownerId}")
    public List<PetDTO> getPetsByOwner(@PathVariable long ownerId) {
        return petService.getPetsByOwnerId(ownerId)
                .stream()
                .map(this::petToPetDTO)
                .collect(Collectors.toList());
    }

    @GetMapping
    public List<PetDTO> getPets() {
        return petService.getPets()
                .stream()
                .map(this::petToPetDTO)
                .collect(Collectors.toList());
    }

    public PetDTO petToPetDTO(Pet pet) {
        PetDTO petDTO = new PetDTO();
        petDTO.setId(pet.getId());
        petDTO.setType(pet.getPetType());
        petDTO.setName(pet.getName());
        petDTO.setBirthDate(pet.getBirthDate());
        petDTO.setNotes(pet.getNotes());
        petDTO.setOwnerId(pet.getCustomer().getId());

        return petDTO;
    }
}
