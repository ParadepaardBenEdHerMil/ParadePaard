package com.pm.payrollservice.repository;

import com.pm.payrollservice.model.Jaaropgaaf;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JaaropgaafRepository extends JpaRepository<Jaaropgaaf, UUID> {

    Optional<Jaaropgaaf> findByCompanyIdAndUserIdAndYear(UUID companyId, UUID userId, int year);

    List<Jaaropgaaf> findByCompanyIdAndYear(UUID companyId, int year);
}
