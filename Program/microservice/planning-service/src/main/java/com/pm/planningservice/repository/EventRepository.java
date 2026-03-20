package com.pm.planningservice.repository;

import com.pm.planningservice.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventRepository extends JpaRepository<Event, UUID> {
    List<Event> findByCompanyIdOrderByStartDateAsc(UUID companyId);

    Optional<Event> findByEventIdAndCompanyId(UUID eventId, UUID companyId);

    List<Event> findByEventIdIn(Collection<UUID> eventIds);
}
