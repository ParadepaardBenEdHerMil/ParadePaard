package com.pm.userservice.service;

import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.mapper.UserMapper;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserDuplicateValidator userDuplicateValidator;

    public record ProfilePicture(byte[] data, String contentType) {}

    public UserService(UserRepository userRepository, UserDuplicateValidator userDuplicateValidator) {
        this.userRepository = userRepository;
        this.userDuplicateValidator = userDuplicateValidator;
    }

    @Transactional(readOnly = true)
    public List<UserResponseDTO> getUsers() {
        List<User> users = userRepository.findAll();
        return users.stream().map(UserMapper::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public UserResponseDTO getUserById(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        return UserMapper.toDTO(user);
    }

    @Transactional
    public UserResponseDTO updateUser(UUID id, UserRequestDTO userRequestDTO) {
        User existing = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));

        userDuplicateValidator.validateNoDuplicate(id, userRequestDTO);

        existing.setEmail(userRequestDTO.getEmail());
        existing.setPreferredName(userRequestDTO.getPreferredName());
        existing.setFirstNames(userRequestDTO.getFirstNames());
        existing.setMiddleNamePrefix(userRequestDTO.getMiddleNamePrefix());
        existing.setLastName(userRequestDTO.getLastName());
        existing.setGender(userRequestDTO.getGender());
        existing.setDateOfBirth(
                userRequestDTO.getDateOfBirth() != null
                        ? java.time.LocalDate.parse(userRequestDTO.getDateOfBirth())
                        : null
        );
        existing.setMobileNumber(userRequestDTO.getMobileNumber());
        existing.setStreet(userRequestDTO.getStreet());
        existing.setHouseNumber(userRequestDTO.getHouseNumber());
        existing.setHouseNumberSuffix(userRequestDTO.getHouseNumberSuffix());
        existing.setPostalCode(userRequestDTO.getPostalCode());
        existing.setCity(userRequestDTO.getCity());
        existing.setCountry(userRequestDTO.getCountry());
        existing.setIban(userRequestDTO.getIban());

        User updatedUser = userRepository.save(existing);
        return UserMapper.toDTO(updatedUser);
    }

    @Transactional(readOnly = true)
    public Optional<ProfilePicture> getProfilePicture(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        byte[] data = user.getProfilePicture();
        if (data == null || data.length == 0) return Optional.empty();
        return Optional.of(new ProfilePicture(data, user.getProfilePictureContentType()));
    }

    @Transactional
    public void updateProfilePicture(UUID id, byte[] data, String contentType) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        user.setProfilePicture(data);
        user.setProfilePictureContentType(contentType);
        userRepository.save(user);
    }

    @Transactional
    public void removeProfilePicture(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        user.setProfilePicture(null);
        user.setProfilePictureContentType(null);
        userRepository.save(user);
    }

    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with id: " + id + " not found");
        }
        userRepository.deleteByUserId(id);
    }
}
