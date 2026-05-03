const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/i;

const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function durationToSeconds(value) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(DURATION_PATTERN);

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  return amount * UNIT_TO_SECONDS[unit];
}

export function durationToMilliseconds(value) {
  return durationToSeconds(value) * 1000;
}
