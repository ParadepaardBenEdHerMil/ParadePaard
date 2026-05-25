CREATE TABLE IF NOT EXISTS timesheets
(
    timesheet_id      UUID PRIMARY KEY,
    user_id           UUID NOT NULL,
    date_of_issue     DATE NOT NULL,
    week_number       INTEGER,
    week_based_year   INTEGER,
    name              VARCHAR(255),
    function          VARCHAR(255),
    hours_worked      NUMERIC(19,2),
    travel_expenses   NUMERIC(19,2)
);

DELETE FROM timesheets;
