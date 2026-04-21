package com.pm.userservice.repository;

import com.pm.userservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User>  findByUserId(UUID id);
    Optional<User> findByUserIdAndCompanyId(UUID id, UUID companyId);
    List<User> findByUserIdIn(Collection<UUID> userIds);
    List<User> findAllByCompanyId(UUID companyId);
    Page<User> findAllByCompanyId(UUID companyId, Pageable pageable);

    void deleteByUserId(UUID id);


    boolean existsByEmail(String email);
    boolean existsByEmailAndUserIdNot(String email, UUID id);
    boolean existsByEmailAndCompanyIdAndUserIdNot(String email, UUID companyId, UUID id);
    boolean existsByMobileNumberAndUserIdNot(String mobileNumber, UUID id);

}
