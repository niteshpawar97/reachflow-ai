/** Ramp curve for a warming-up mailbox: exponential growth from a small base,
 * capped at the mailbox's configured daily limit. Day 0 = the day warmup started. */
export function warmupEffectiveLimit(dailyLimit: number, daysSinceStart: number): number {
  const day = Math.max(0, daysSinceStart);
  const ramped = Math.round(5 * Math.pow(1.35, day));
  return Math.min(dailyLimit, ramped);
}

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

/** True once the ramp has caught up to the mailbox's real daily limit. */
export function isWarmupComplete(dailyLimit: number, daysSinceStart: number): boolean {
  return warmupEffectiveLimit(dailyLimit, daysSinceStart) >= dailyLimit;
}
