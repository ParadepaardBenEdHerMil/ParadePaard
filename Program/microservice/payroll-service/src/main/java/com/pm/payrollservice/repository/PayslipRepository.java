package com.pm.payrollservice.repository;

import com.pm.payrollservice.model.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, UUID>{

}
