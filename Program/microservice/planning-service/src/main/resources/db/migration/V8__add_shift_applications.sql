-- Shift applications: employees can apply to open shifts from the open-shifts
-- marketplace. A row means "this user applied to this shift"; withdrawing an
-- application (or a planner scheduling the applicant) removes the row again,
-- so no status column is needed.

CREATE TABLE IF NOT EXISTS shift_applications (
    shift_application_id UUID      NOT NULL,
    shift_id             UUID      NOT NULL,
    user_id              UUID      NOT NULL,
    applied_at           TIMESTAMP NOT NULL,
    CONSTRAINT pk_shift_applications PRIMARY KEY (shift_application_id),
    CONSTRAINT uq_shift_application_shift_user UNIQUE (shift_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_application_shift
    ON shift_applications (shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_application_user
    ON shift_applications (user_id);
