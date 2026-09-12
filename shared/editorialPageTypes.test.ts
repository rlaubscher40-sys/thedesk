import { expect, it } from "vitest";
import { nonNewsFormatHold } from "./editorialPageTypes";
import { referenceNewsHold } from "./editorial";
it.each([
  [
    "First home buyer scores historic cottage despite $60,000 higher bid",
    "individual-property-purchase",
  ],
  ["Couple buys Melbourne house after fierce bidding", "individual-property-purchase"],
  [
    "Renting can seem like a lottery. How can you improve your chances of getting a lease?",
    "rental-application-guide",
  ],
  [
    "One week left to book your exhibit table at TechCrunch Disrupt 2026",
    "event-booking-promotion",
  ],
  ["Final, final, final call for TechCrunch Disrupt 2026 Side Events", "event-booking-promotion"],
])("holds non-news page formats: %s", (title, reason) => {
  expect(nonNewsFormatHold({ title })).toBe(reason);
  expect(referenceNewsHold({ title, channel: "TECH" })).toBe(reason);
});
it.each([
  "First home buyers win expanded deposit guarantee",
  "Woman wins court ruling over defective apartment",
  "ASIC charges property developer over alleged fraud",
  "New rental privacy laws change how to submit a rental application",
  "How do new laws improve your chances of getting a lease?",
  "AI company launches a new model at industry conference",
  "Australian auction clearance rate rises to 70%",
  "Housing approvals granted for 95 homes in Bega",
])("keeps substantive policy, market and product news: %s", (title) => {
  expect(nonNewsFormatHold({ title })).toBeNull();
});
