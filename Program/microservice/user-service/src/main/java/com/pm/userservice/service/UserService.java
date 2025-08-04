package com.pm.userservice.service;

import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.mapper.UserMapper;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserDuplicateValidator userDuplicateValidator;

    public UserService(UserRepository userRepository, UserDuplicateValidator userDuplicateValidator) {
        this.userRepository = userRepository;
        this.userDuplicateValidator = userDuplicateValidator;
    }

    public List<UserResponseDTO> getUsers() {
        List<User> users = userRepository.findAll();
        return users.stream().map(UserMapper::toDTO).toList();
    }

    public UserResponseDTO updateUser(UUID id, UserRequestDTO userRequestDTO) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));

        userDuplicateValidator.validateNoDuplicate(id, userRequestDTO);

        user.setName(userRequestDTO.getName()); // TODO clean up
        user.setEmail(userRequestDTO.getEmail());
        user.setStreetName(userRequestDTO.getStreetName());
        user.setHouseNumber(userRequestDTO.getHouseNumber());
        user.setHouseNumberSuffix(userRequestDTO.getHouseNumberSuffix());
        user.setPostalCode(userRequestDTO.getPostalCode());
        user.setCity(userRequestDTO.getCity());
        user.setCountry(userRequestDTO.getCountry());
        if (userRequestDTO.getDateOfBirth() != null && !userRequestDTO.getDateOfBirth().isBlank()) {
            user.setDateOfBirth(LocalDate.parse(userRequestDTO.getDateOfBirth()));
        }
        user.setPhoneNumber(userRequestDTO.getPhoneNumber());
        user.setBankAccountNumber(userRequestDTO.getBankAccountNumber());

        User updatedUser = userRepository.save(user);
        return UserMapper.toDTO(updatedUser);
    }

    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with id: " + id + " not found");
        }
        userRepository.deleteByUserId(id);
    }
}
