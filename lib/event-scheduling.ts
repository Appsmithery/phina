import type { Event } from "@/types/database";

export const DEFAULT_EVENT_TIMEZONE = "America/New_York";
export const DEFAULT_RATING_WINDOW_MINUTES = 5;
export const RATING_WINDOW_OPTIONS = [5, 10, 15] as const;

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_EVENT_TIMEZONE;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

export function combineLocalDateAndTime(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

export function extractTimeValue(dateTime: string | null | undefined): string {
  if (!dateTime) return "19:00";

  const date = new Date(dateTime);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function isEventEnded(event: Pick<Event, "status" | "ends_at">): boolean {
  return event.status === "ended" || new Date(event.ends_at).getTime() <= Date.now();
}

export function formatEventDate(dateTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(dateTime));
}

export function formatEventDateLong(dateTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateTime));
}

export function formatEventTime(dateTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateTime));
}

export function formatEventTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string {
  return `${formatEventTime(startsAt, timeZone)} - ${formatEventTime(endsAt, timeZone)}`;
}
