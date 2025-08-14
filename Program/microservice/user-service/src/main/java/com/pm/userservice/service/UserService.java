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

    public UserResponseDTO getUserById(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        return UserMapper.toDTO(user);
    }

    public UserResponseDTO updateUser(UUID id, UserRequestDTO userRequestDTO) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with id: " + id + " not found");
        }

        userDuplicateValidator.validateNoDuplicate(id, userRequestDTO);

        User user = UserMapper.toModel(userRequestDTO);

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
