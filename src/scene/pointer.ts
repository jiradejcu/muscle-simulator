/** Where the last pointer press happened, to tell a click from a drag (e.g. Alt+left orbit). */
const down = { x: 0, y: 0 }

export function rememberPointerDown(e: { clientX: number; clientY: number }) {
  down.x = e.clientX
  down.y = e.clientY
}

/** True for a plain left click that did not move more than a few pixels. */
export function isPlainClick(e: { clientX: number; clientY: number; button: number }) {
  return e.button === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5
}
