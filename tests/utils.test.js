const { patternToRegExp, isValidPattern, clampPosition } = require('./utils');

// --- patternToRegExp ---

describe('patternToRegExp', () => {
  test('matches http URL with wildcard scheme', () => {
    const re = patternToRegExp('*://reddit.com/*');
    expect(re.test('https://reddit.com/')).toBe(true);
    expect(re.test('http://reddit.com/r/all')).toBe(true);
    expect(re.test('ftp://reddit.com/')).toBe(true);
  });

  test('does not match different host', () => {
    const re = patternToRegExp('*://reddit.com/*');
    expect(re.test('https://notrreddit.com/')).toBe(false);
  });

  test('matches https scheme only', () => {
    const re = patternToRegExp('https://example.com/*');
    expect(re.test('https://example.com/page')).toBe(true);
    expect(re.test('http://example.com/page')).toBe(false);
  });

  test('escapes dots in host name', () => {
    const re = patternToRegExp('*://example.com/*');
    expect(re.test('https://exampleXcom/')).toBe(false);
  });

  test('wildcard path matches any path', () => {
    const re = patternToRegExp('*://youtube.com/*');
    expect(re.test('https://youtube.com/watch?v=abc')).toBe(true);
    expect(re.test('https://youtube.com/')).toBe(true);
  });

  test('literal path matches exactly', () => {
    const re = patternToRegExp('https://example.com/page');
    expect(re.test('https://example.com/page')).toBe(true);
    expect(re.test('https://example.com/other')).toBe(false);
  });
});

// --- isValidPattern ---

describe('isValidPattern', () => {
  test('accepts wildcard scheme', () => {
    expect(isValidPattern('*://reddit.com/*')).toBe(true);
  });

  test('accepts https scheme', () => {
    expect(isValidPattern('https://example.com/*')).toBe(true);
  });

  test('accepts http scheme', () => {
    expect(isValidPattern('http://example.com/*')).toBe(true);
  });

  test('accepts ftp scheme', () => {
    expect(isValidPattern('ftp://example.com/*')).toBe(true);
  });

  test('rejects <all_urls>', () => {
    expect(isValidPattern('<all_urls>')).toBe(false);
  });

  test('rejects bare hostname', () => {
    expect(isValidPattern('reddit.com')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidPattern('')).toBe(false);
  });

  test('rejects whitespace only', () => {
    expect(isValidPattern('   ')).toBe(false);
  });

  test('rejects unknown scheme', () => {
    expect(isValidPattern('file://foo')).toBe(false);
  });
});

// --- clampPosition ---

describe('clampPosition', () => {
  test('leaves in-bounds position unchanged', () => {
    expect(clampPosition(100, 200, 1280, 800)).toEqual({ x: 100, y: 200 });
  });

  test('clamps x when too far right', () => {
    // max x = 1280 - 200 = 1080
    expect(clampPosition(1200, 100, 1280, 800)).toEqual({ x: 1080, y: 100 });
  });

  test('clamps y when too far down', () => {
    // max y = 800 - 355 = 445
    expect(clampPosition(100, 500, 1280, 800)).toEqual({ x: 100, y: 445 });
  });

  test('clamps x to 0 when negative', () => {
    expect(clampPosition(-10, 100, 1280, 800)).toEqual({ x: 0, y: 100 });
  });

  test('clamps y to 0 when negative', () => {
    expect(clampPosition(100, -5, 1280, 800)).toEqual({ x: 100, y: 0 });
  });

  test('clamps both axes simultaneously', () => {
    expect(clampPosition(9999, 9999, 1280, 800)).toEqual({ x: 1080, y: 445 });
  });
});
