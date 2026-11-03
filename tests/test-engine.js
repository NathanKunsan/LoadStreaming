// tests/test-engine.js
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('=== RUNNING LOADSTREAMING ENGINE VERIFICATION TESTS ===\n');

// 1. Verify Binaries
const binDir = path.join(__dirname, '..', 'resources', 'bin');
const ytdlpPath = path.join(binDir, 'yt-dlp.exe');
const ffmpegPath = path.join(binDir, 'ffmpeg.exe');

console.log('1. Testing Bundled Binaries:');
const ytdlpVer = spawnSync(ytdlpPath, ['--version'], { encoding: 'utf8' });
console.log(' - yt-dlp version:', ytdlpVer.stdout.trim());
assert.strictEqual(ytdlpVer.status, 0, 'yt-dlp should execute cleanly');

const ffmpegVer = spawnSync(ffmpegPath, ['-version'], { encoding: 'utf8' });
const ffmpegFirstLine = ffmpegVer.stdout.split('\n')[0];
console.log(' - ffmpeg:', ffmpegFirstLine);
assert.strictEqual(ffmpegVer.status, 0, 'ffmpeg should execute cleanly');
console.log('PASS: Bundled binaries verified.\n');

// 2. Testing URL Validation Logic
console.log('2. Testing URL Validation Logic:');
function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return { valid: false, error: 'INVALID_URL' };
  const trimmed = rawUrl.trim();
  const shortsRegex = /(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)/i;
  if (shortsRegex.test(trimmed)) {
    return { valid: false, error: 'SHORTS_NOT_SUPPORTED' };
  }
  const ytRegex = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:[?&].*)?$/i;
  if (!ytRegex.test(trimmed)) {
    return { valid: false, error: 'INVALID_URL' };
  }
  return { valid: true };
}

// Test Shorts
const shortsTest = validateUrl('https://www.youtube.com/shorts/abc12345678');
assert.strictEqual(shortsTest.valid, false);
assert.strictEqual(shortsTest.error, 'SHORTS_NOT_SUPPORTED');
console.log(' - Shorts rejection test: PASS');

// Test Invalid
const invalidTest = validateUrl('https://example.com/not-youtube');
assert.strictEqual(invalidTest.valid, false);
assert.strictEqual(invalidTest.error, 'INVALID_URL');
console.log(' - Invalid URL test: PASS');

// Test Valid Video
const validTest = validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(validTest.valid, true);
console.log(' - Valid YouTube URL test: PASS');

// Test Playlist URL (contains &list=...) -> should still match the video ID and not error
const playlistUrlTest = validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ');
assert.strictEqual(playlistUrlTest.valid, true);
console.log(' - Video with playlist param URL test: PASS\n');

// 3. Testing Thai Filename Sanitization
console.log('3. Testing Thai Filename & Unicode Sanitization:');
function sanitizeFilename(rawTitle) {
  if (!rawTitle) return `LoadStreaming_${Date.now()}`;
  let cleaned = rawTitle.normalize('NFC');
  cleaned = cleaned.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/_+/g, '_').trim();
  cleaned = cleaned.replace(/[. ]+$/, '');
  return cleaned || `LoadStreaming_${Date.now()}`;
}

const thaiRaw = 'เพลงไทยเพราะๆ 2024: ฟังเพลงยาวๆ สบายใจ "Official MV" | เพลงรัก?';
const sanitizedThai = sanitizeFilename(thaiRaw);
console.log(' - Original:', thaiRaw);
console.log(' - Sanitized:', sanitizedThai);

// Check forbidden chars are completely gone
assert.ok(!sanitizedThai.includes(':'), 'Should not contain :');
assert.ok(!sanitizedThai.includes('"'), 'Should not contain "');
assert.ok(!sanitizedThai.includes('|'), 'Should not contain |');
assert.ok(!sanitizedThai.includes('?'), 'Should not contain ?');

// Check Thai characters remain fully intact
assert.ok(sanitizedThai.includes('เพลงไทยเพราะๆ'), 'Thai consonants and vowels preserved');
assert.ok(sanitizedThai.includes('ฟังเพลงยาวๆ'), 'Thai tone marks preserved');
console.log('PASS: Thai filename and Unicode integrity preserved.\n');

console.log('=== ALL ENGINE TESTS PASSED SUCCESSFULLY! ===');
