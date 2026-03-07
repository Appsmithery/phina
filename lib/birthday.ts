export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatBirthday(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBirthdayForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAge(birthday: Date, today = new Date()): number {
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }
  return age;
}

export function getLatestAllowedBirthday(minAge = 21, today = new Date()): Date {
  return new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function clampBirthdayToBounds(date: Date, maximumDate: Date): Date {
  if (date > maximumDate) {
    return new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function setBirthdayYear(date: Date, year: number, maximumDate: Date): Date {
  const month = date.getMonth();
  const day = Math.min(date.getDate(), daysInMonth(year, month));
  return clampBirthdayToBounds(new Date(year, month, day), maximumDate);
}

export function getBirthdayYearOptions(minAge = 21, yearsBack = 120, today = new Date()): number[] {
  const latestYear = today.getFullYear() - minAge;
  return Array.from({ length: yearsBack }, (_, index) => latestYear - index);
}

export function getDefaultBirthday(maximumDate = getLatestAllowedBirthday()): Date {
  return new Date(maximumDate.getFullYear() - 9, 0, 1);
}
