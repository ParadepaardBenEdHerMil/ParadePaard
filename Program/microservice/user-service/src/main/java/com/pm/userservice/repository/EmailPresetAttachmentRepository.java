package com.pm.userservice.repository;

import com.pm.userservice.model.EmailPresetAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailPresetAttachmentRepository extends JpaRepository<EmailPresetAttachment, UUID> {
    List<EmailPresetAttachment> findByPresetIdOrderByCreatedAtAsc(UUID presetId);

    Optional<EmailPresetAttachment> findByIdAndPresetId(UUID id, UUID presetId);

    long countByPresetId(UUID presetId);

    void deleteByPresetId(UUID presetId);
}
