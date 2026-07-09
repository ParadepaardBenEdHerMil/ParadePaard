package com.pm.userservice.repository;

import com.pm.userservice.model.FeedbackEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FeedbackEntryRepository extends JpaRepository<FeedbackEntry, UUID> {
    List<FeedbackEntry> findAllByOrderByCreatedAtDesc();
}
