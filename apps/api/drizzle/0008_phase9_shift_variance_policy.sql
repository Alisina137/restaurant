-- P09 shift variance threshold is per restaurant, stored in AFN minor units.
-- Separate additive migration because 0007 may already exist on development machines.
ALTER TABLE finance_settings ADD COLUMN shift_variance_limit_minor integer
 NOT NULL DEFAULT 5000 CHECK (shift_variance_limit_minor BETWEEN 0 AND 100000000);
