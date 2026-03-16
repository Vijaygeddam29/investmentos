export function getNextSundayAt2AM(): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(2, 0, 0, 0);

  // How many days until Sunday (0 = today is Sunday)
  let daysUntilSunday = (7 - candidate.getUTCDay()) % 7;

  // If today is already Sunday and 2AM is still in the future, run today
  // If today is Sunday but 2AM has already passed, push to next Sunday (+7)
  if (daysUntilSunday === 0 && candidate <= now) {
    daysUntilSunday = 7;
  }

  candidate.setUTCDate(candidate.getUTCDate() + daysUntilSunday);
  return candidate;
}
