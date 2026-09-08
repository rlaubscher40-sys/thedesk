CREATE TABLE planning_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  councilName VARCHAR(100) NOT NULL,
  periodFrom VARCHAR(10) NOT NULL,
  periodTo VARCHAR(10) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  snapshot JSON NOT NULL,
  records JSON NOT NULL,
  storedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_planning_council_period (councilName, periodFrom, periodTo, id)
);
