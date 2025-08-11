package com.pm.contractservice.repository;

import com.pm.contractservice.model.Contract;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ContractRepository extends JpaRepository<Contract, UUID> {

    @EntityGraph(attributePaths = "functions")
    Optional<Contract> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);
}