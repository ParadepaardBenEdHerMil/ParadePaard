package com.pm.contractservice.repository;

import com.pm.contractservice.model.Function;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FunctionRepository extends JpaRepository<Function, UUID> {
    boolean existsByFunctionName(String functionName);

    Function findByFunctionName(String functionName);

    Optional<Function> findFirstByFunctionNameIgnoreCase(String functionName);

}
