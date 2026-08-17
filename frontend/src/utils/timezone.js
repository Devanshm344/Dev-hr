// Formats a UTC ISO timestamp in a SPECIFIC employee's own office timezone,
// with an explicit offset/abbreviation — never the viewer's browser timezone.
// Needed once the workforce spans India/US/Canada: an HR admin in Hyderabad
// looking at a Toronto employee's check-in time must see it's Toronto time,
// not have it silently converted to their own.
export function formatDateTimeInTz(iso, tz) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'Asia/Kolkata',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

// No timeZoneName here by design — this drives the personal, always-visible
// clocks (header, dashboard, own attendance rows), where a viewer looking at
// their own time doesn't need "CDT" spelled out next to it every second.
// formatDateTimeInTz above still carries the label, for the admin-facing
// spots where the timestamp belongs to someone else.
export function formatTimeInTz(iso, tz, { seconds = false } = {}) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}),
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleTimeString()
  }
}

// For the live header/dashboard clock — "now" in the VIEWING employee's own
// office, not the machine the browser happens to be running on. A US
// employee should see their own local time even if the device's system
// clock is set to IST (true for this dev environment).
export function formatDateInTz(date, tz, { withYear = true, monthStyle = 'long', weekdayStyle = 'long' } = {}) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'Asia/Kolkata',
      weekday: weekdayStyle, ...(withYear ? { year: 'numeric' } : {}), month: monthStyle, day: 'numeric',
    }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}
