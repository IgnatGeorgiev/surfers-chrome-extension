/**
 * Converts a Chrome-style match pattern to a RegExp.
 * Only supports: (http|https|ftp|*)://host/path syntax.
 */
function patternToRegExp(pattern) {
  // Escape regex metacharacters except *
  let escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Handle scheme wildcard
  if (escaped.startsWith('*://')) {
    escaped = '(https?|ftp)://' + escaped.slice(4);
  }
  // Replace remaining * with .*
  escaped = escaped.replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

/**
 * Returns true if the pattern is a valid supported match pattern.
 */
function isValidPattern(pattern) {
  return /^(https?|ftp|\*):\/\//.test(pattern) && pattern.trim().length > 0;
}

/**
 * Clamps a position so the overlay (200x355px) stays within the viewport.
 */
function clampPosition(x, y, viewportWidth, viewportHeight) {
  return {
    x: Math.max(0, Math.min(x, viewportWidth - 200)),
    y: Math.max(0, Math.min(y, viewportHeight - 355)),
  };
}

module.exports = { patternToRegExp, isValidPattern, clampPosition };
