-- Where a subscriber came from, as distinct from which form converted them.
--
-- `subscribers.source` already stored the placement ("first-visit-modal"), so
-- every subscriber looked identical regardless of channel and the question
-- "has Instagram produced a subscriber" could not be asked. These columns
-- carry the arrival channel captured on the first page of the session.
--
-- `page_views.campaign` exists because Instagram's in-app browser frequently
-- sends no Referer: without a tagged link its traffic is indistinguishable
-- from direct, which undercounts precisely the channel being measured.
--
-- All nullable: existing rows predate the capture and must stay valid.
ALTER TABLE `subscribers` ADD COLUMN `arrivalSource` varchar(64);
ALTER TABLE `subscribers` ADD COLUMN `arrivalCampaign` varchar(64);
ALTER TABLE `page_views` ADD COLUMN `campaign` varchar(64);
