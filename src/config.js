// BASE_URL is embedded into .ics DESCRIPTION fields so events deep-link back
// here. Resolved from the runtime location, so it works in dev (localhost) and
// in production (GitHub Pages) without hand-editing.
export const BASE_URL = window.location.origin + window.location.pathname.replace(/\/$/, '');
