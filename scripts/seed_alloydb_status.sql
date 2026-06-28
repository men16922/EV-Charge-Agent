-- seed_alloydb_status.sql
-- Minimal seed for the check_charger_status tool (live_charger_status table).
-- Mirrors the mock rows in mcp_server_local.py so the deployed AlloyDB path
-- returns the same demo data. Loaded into AlloyDB database ev_charge_db.

CREATE TABLE IF NOT EXISTS live_charger_status (
  charger_id      TEXT PRIMARY KEY,
  status          TEXT,
  current_load_kw DOUBLE PRECISION,
  error_code      TEXT,
  last_updated    TIMESTAMP
);

INSERT INTO live_charger_status (charger_id, status, current_load_kw, error_code, last_updated) VALUES
  ('CHG-1001', 'active', 45.2, 'NONE',             '2026-06-22 20:55:00'),
  ('CHG-1002', 'idle',    0.0, 'NONE',             '2026-06-22 20:56:00'),
  ('CHG-1003', 'broken',  0.0, 'ERR_CONN_TIMEOUT', '2026-06-22 18:30:00'),
  ('CHG-1004', 'broken',  0.0, 'ERR_OVERHEATING',  '2026-06-22 20:45:00')
ON CONFLICT (charger_id) DO UPDATE SET
  status = EXCLUDED.status,
  current_load_kw = EXCLUDED.current_load_kw,
  error_code = EXCLUDED.error_code,
  last_updated = EXCLUDED.last_updated;
