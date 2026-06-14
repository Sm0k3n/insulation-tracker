-- Adds optional username (unique) and removes the UNIQUE constraint on email.
-- Email may now be reused up to 4 times — the cap is enforced in app code
-- (SQLite can't express it in a CHECK without a subquery).
-- Login accepts an identifier matching either username or email.

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Admin', 'Foreman', 'Delivery Driver', 'Employee')),
  assigned_po   TEXT,
  phone         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

INSERT INTO users_new (id, name, username, email, password_hash, password_salt, role, assigned_po, phone, created_at, updated_at)
SELECT id, name, NULL, email, password_hash, password_salt, role, assigned_po, phone, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

PRAGMA foreign_keys = ON;
