CREATE TABLE security_limits (bucketKey VARCHAR(191) PRIMARY KEY, used INT NOT NULL DEFAULT 0, expiresMs BIGINT NOT NULL, INDEX idx_security_limits_expiry (expiresMs));
--> statement-breakpoint
CREATE TABLE admin_sessions (sessionId VARCHAR(64) PRIMARY KEY, expiresMs BIGINT NOT NULL, INDEX idx_admin_sessions_expiry (expiresMs));
