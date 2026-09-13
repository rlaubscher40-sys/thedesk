import { INSTAGRAM_FEED_SLOTS, sydneySocialClock } from "./instagramSchedule";
/** Next configured feed slot, not a promise that its evidence will qualify. */
export function nextPublicationSlot(now = new Date()) {
  const today = sydneySocialClock(now);
  const start = Date.parse(`${today.dateISO}T12:00:00Z`);
  const names = {
    daily: "Property briefing",
    stat: "The Number",
    weekly: "Weekly recap",
    monthly: "Monthly review",
  };
  for (let day = 0; day < 32; day++) {
    const clock = sydneySocialClock(new Date(start + day * 86400000));
    const slots = Object.entries(INSTAGRAM_FEED_SLOTS)
      .flatMap(([key, slot]) => {
        if ("dow" in slot && !slot.dow.includes(clock.dow)) return [];
        if ("dom" in slot && slot.dom.some((date) => date !== clock.dom)) return [];
        if ("excludeDom" in slot && slot.excludeDom.includes(clock.dom)) return [];
        const [hour, minute] = slot.at.split(":").map(Number);
        const minutes = hour! * 60 + minute!;
        if (day === 0 && minutes <= today.minutes) return [];
        return [
          { name: names[key as keyof typeof names], at: slot.at, date: clock.dateISO, minutes },
        ];
      })
      .sort((a, b) => a.minutes - b.minutes);
    if (slots[0]) return slots[0];
  }
  return null;
}
