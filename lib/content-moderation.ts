export interface ModeratedTextField {
  label: string;
  value: string | null | undefined;
}

const DISALLOWED_PATTERNS: RegExp[] = [
  /\b(?:fuck|fucking|shit|bitch|asshole|cunt|slut|whore)\b/i,
  /\b(?:kill yourself|go die|i(?:'| a)m going to kill you)\b/i,
  /\b(?:rape|rapist|porn|nudes?)\b/i,
];

function containsDisallowedText(value: string): boolean {
  return DISALLOWED_PATTERNS.some((pattern) => pattern.test(value));
}

export function getModerationFieldLabels(
  fields: ModeratedTextField[],
): string[] {
  return fields
    .filter((field) => {
      const trimmedValue = field.value?.trim();
      return !!trimmedValue && containsDisallowedText(trimmedValue);
    })
    .map((field) => field.label);
}

export function getModerationErrorMessage(fields: ModeratedTextField[]): string | null {
  const flaggedLabels = getModerationFieldLabels(fields);
  if (flaggedLabels.length === 0) return null;

  const labels = flaggedLabels.join(", ");
  const noun = flaggedLabels.length === 1 ? "field" : "fields";
  return `Please remove abusive or explicit language from the following ${noun}: ${labels}.`;
}
