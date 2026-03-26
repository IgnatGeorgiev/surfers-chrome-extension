const SITES_KEY = 'sites';

function isValidPattern(pattern) {
  return /^(https?|ftp|\*):\/\//.test(pattern) && pattern.trim().length > 0;
}
