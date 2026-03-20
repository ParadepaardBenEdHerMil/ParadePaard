// PlanningViewPlan.tsx
// Structure plan for the admin planning and rostering screen.

import { useMemo, useState } from "react";

type PlanningEvent = {
  eventId: string;
  eventName: string;
  startDate: string;
  endDate: string;
  days: PlanningDay[];
};

type PlanningDay = {
  day: string;
  allocations: PlanningAllocation[];
};

type PlanningAllocation = {
  scheduleEntryId: string;
  shiftId: string;
  userId: string;
  userDisplayName?: string;
  startTime: string;
  endTime: string;
  functionName: string;
  status: "ASSIGNED" | "CONFIRMED" | "CANCELLED";
};

export default function PlanningViewPlan() {
  const [events] = useState<PlanningEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const visibleDays = selectedEvent?.days ?? [];
  const visibleAllocations =
    visibleDays.find((day) => day.day === selectedDay)?.allocations ?? [];

  return (
    <section className="planning-view">
      {/* Level 1: Event selection */}
      <header className="planning-view__events">
        <h1>Planning</h1>
        {/* Render searchable event dropdown/list */}
      </header>

      {/* Level 2: Day view for selected event */}
      <aside className="planning-view__days">
        {/* Render tabs/chips for event days */}
      </aside>

      {/* Level 3: Resource allocation for selected day */}
      <main className="planning-view__allocations">
        {/* Render rows grouped by user with start/end/function/status */}
        {/* Include actions: assign, reassign, remove, status change */}
      </main>

      {/* Footer action */}
      <footer className="planning-view__actions">
        {/* Finalize Event button */}
      </footer>
    </section>
  );
}
