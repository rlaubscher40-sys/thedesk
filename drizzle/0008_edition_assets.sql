CREATE TABLE `edition_assets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `editionId` int NOT NULL,
  `kind` varchar(32) NOT NULL,
  `contentType` varchar(64) NOT NULL,
  `bytes` mediumblob NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `edition_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_edition_assets_lookup` ON `edition_assets` (`editionId`, `kind`, `createdAt`);
