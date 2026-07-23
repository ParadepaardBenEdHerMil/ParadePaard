-- V4: seed a starter set of job functions so the shift-planning function picker and the admin
-- functions list are usable out of the box. Fixed ids + ON CONFLICT DO NOTHING make re-runs no-ops.
INSERT INTO public.functions (id, active, department, name, hourly_wage) VALUES
    ('a1000000-0000-4000-8000-000000000001', true, 'Operations', 'Bar staff',        20.00),
    ('a1000000-0000-4000-8000-000000000002', true, 'Operations', 'Runner',           18.75),
    ('a1000000-0000-4000-8000-000000000003', true, 'Operations', 'Host / Hostess',   19.00),
    ('a1000000-0000-4000-8000-000000000004', true, 'Operations', 'Waiter',           19.50),
    ('a1000000-0000-4000-8000-000000000005', true, 'Operations', 'Supervisor',       24.50),
    ('a1000000-0000-4000-8000-000000000006', true, 'Kitchen',    'Kitchen assistant',21.00),
    ('a1000000-0000-4000-8000-000000000007', true, 'Kitchen',    'Dishwasher',       18.00)
ON CONFLICT (id) DO NOTHING;
