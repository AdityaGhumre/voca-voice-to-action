/**
 * Utility functions for local server date and time resolution, formatting, and validation.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns YYYY-MM-DD in the local server timezone.
 */
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns formatted 12-hour time in local server timezone (e.g. "05:45 PM").
 */
export function getLocalTimeString(d = new Date()) {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  return `${strHours}:${minutes} ${ampm}`;
}

/**
 * Returns 24-hour time in local server timezone (e.g. "17:45").
 */
export function getLocalTime24String(d = new Date()) {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Parses a 12-hour or 24-hour time string into { hours, minutes, seconds }.
 * Examples: "05:00 PM", "5:00 PM", "5pm", "17:00", "09:30 AM", "9:30"
 */
export function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim().toLowerCase();
  if (!trimmed || trimmed === 'all day' || trimmed === 'upcoming') return null;

  // 12-hour format: "5:30 pm", "05:30pm", "5 pm", "5pm", "12:15 am"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const seconds = match12[3] ? parseInt(match12[3], 10) : 0;
    const meridiem = match12[4].toLowerCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return null;
    }
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return { hours, minutes, seconds };
  }

  // 24-hour format: "17:00", "09:30", "17:00:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    const seconds = match24[3] ? parseInt(match24[3], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
      return { hours, minutes, seconds };
    }
  }

  return null;
}

/**
 * Parses a date string into components { year, month, day, dateISO }.
 * Supports "YYYY-MM-DD", "today", "tomorrow", "yesterday", and day names like "Friday".
 */
export function parseDateString(dateStr, now = new Date()) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'yesterday') {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      dateISO: getLocalDateString(d),
      isYesterday: true
    };
  }

  if (lower === 'today') {
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      dateISO: getLocalDateString(now),
      isToday: true
    };
  }

  if (lower === 'tomorrow') {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      dateISO: getLocalDateString(d),
      isTomorrow: true
    };
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const testDate = new Date(year, month, day);
    if (!isNaN(testDate.getTime())) {
      const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { year, month, day, dateISO };
    }
  }

  // Day names: "Friday", "Monday", etc.
  const dayIndex = DAY_NAMES.findIndex(name => name.toLowerCase() === lower);
  if (dayIndex !== -1) {
    const currentDay = now.getDay();
    let daysToAdd = (dayIndex - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // Next occurrence
    const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return {
      year: targetDate.getFullYear(),
      month: targetDate.getMonth(),
      day: targetDate.getDate(),
      dateISO: getLocalDateString(targetDate)
    };
  }

  // Fallback: standard Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate(),
      dateISO: getLocalDateString(parsed)
    };
  }

  return null;
}

/**
 * Validates a reminder's scheduled date and time against server current time.
 * Rejects any reminder whose scheduled date and time is earlier than server now.
 *
 * @param {string} rawDate - Scheduled date (e.g. "2026-11-03", "2026-11-04", "yesterday")
 * @param {string|null} rawTime - Scheduled time (e.g. "05:00 PM", "17:00", null)
 * @param {Date} now - Reference server time (default: new Date())
 * @returns {object} { valid: boolean, isPast: boolean, error: string|null, scheduledDate: Date|null, normalizedDate: string, normalizedTime: string|null }
 */
export function validateReminderSchedule(rawDate, rawTime = null, now = new Date()) {
  const PAST_DATE_ERROR = 'This reminder time has already passed. Please choose a future time.';

  if (!rawDate || typeof rawDate !== 'string' || !rawDate.trim()) {
    return {
      valid: false,
      isPast: false,
      error: 'Reminder date is required.',
      scheduledDate: null
    };
  }

  let datePart = rawDate.trim();
  let timePart = rawTime && typeof rawTime === 'string' ? rawTime.trim() : null;

  // If rawDate contains comma (e.g. "2026-11-03, 05:00 PM") and timePart was not provided
  if (!timePart && datePart.includes(',')) {
    const [d, ...t] = datePart.split(',');
    datePart = d.trim();
    timePart = t.join(',').trim();
  }

  const parsedDate = parseDateString(datePart, now);
  if (!parsedDate) {
    return {
      valid: false,
      isPast: false,
      error: `Invalid date format: "${datePart}". Please use YYYY-MM-DD or a valid date.`,
      scheduledDate: null
    };
  }

  // Explicit yesterday check
  if (parsedDate.isYesterday) {
    return {
      valid: false,
      isPast: true,
      error: PAST_DATE_ERROR,
      scheduledDate: new Date(parsedDate.year, parsedDate.month, parsedDate.day, 23, 59, 59, 999),
      normalizedDate: parsedDate.dateISO,
      normalizedTime: timePart
    };
  }

  const parsedTime = timePart ? parseTimeString(timePart) : null;

  if (timePart && !parsedTime) {
    // If a time was specified but could not be parsed, check if it's "all day" or "upcoming"
    const lowerTime = timePart.toLowerCase();
    if (lowerTime !== 'all day' && lowerTime !== 'upcoming') {
      return {
        valid: false,
        isPast: false,
        error: `Invalid time format: "${timePart}". Please use e.g. "05:00 PM" or "17:00".`,
        scheduledDate: null
      };
    }
  }

  if (parsedTime) {
    // Exact timestamp comparison
    const scheduled = new Date(
      parsedDate.year,
      parsedDate.month,
      parsedDate.day,
      parsedTime.hours,
      parsedTime.minutes,
      parsedTime.seconds,
      0
    );

    if (scheduled.getTime() < now.getTime()) {
      return {
        valid: false,
        isPast: true,
        error: PAST_DATE_ERROR,
        scheduledDate: scheduled,
        normalizedDate: parsedDate.dateISO,
        normalizedTime: timePart
      };
    }

    return {
      valid: true,
      isPast: false,
      error: null,
      scheduledDate: scheduled,
      normalizedDate: parsedDate.dateISO,
      normalizedTime: timePart
    };
  }

  // No specific time provided: check if the whole day has already passed (end of day comparison)
  const endOfDay = new Date(parsedDate.year, parsedDate.month, parsedDate.day, 23, 59, 59, 999);

  if (endOfDay.getTime() < now.getTime()) {
    return {
      valid: false,
      isPast: true,
      error: PAST_DATE_ERROR,
      scheduledDate: endOfDay,
      normalizedDate: parsedDate.dateISO,
      normalizedTime: null
    };
  }

  return {
    valid: true,
    isPast: false,
    error: null,
    scheduledDate: new Date(parsedDate.year, parsedDate.month, parsedDate.day, 0, 0, 0, 0),
    normalizedDate: parsedDate.dateISO,
    normalizedTime: null
  };
}
