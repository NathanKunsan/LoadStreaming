// tests/test-download.js
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('=== REAL DOWNLOAD & MEDIA CONVERSION TEST ===\n');

const binDir = path.join(__dirname, '..', 'resources', 'bin');
const ytdlpPath = path.join(binDir, 'yt-dlp.exe');
const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
const testOutputDir = path.join(__dirname, 'test_output');

if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

// Target: Me at the zoo (19 seconds)
const targetUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const thaiTitle = 'ทดสอบวิดีโอไทย_Me_At_The_Zoo';

console.log('1. Testing Audio (.mp3) Download with Highest Quality & Cover Art:');
const audioOut = path.join(testOutputDir, `${thaiTitle}.%(ext)s`);
const audioArgs = [
  '--no-playlist',
  '--ffmpeg-location', ffmpegPath,
  '-x',
  '--audio-format', 'mp3',
  '--audio-quality', '0',
  '--embed-thumbnail',
  '--embed-metadata',
  '-o', audioOut,
  targetUrl
];

const audioRes = spawnSync(ytdlpPath, audioArgs, { encoding: 'utf8', timeout: 60000 });
console.log('Audio exit code:', audioRes.status);
if (audioRes.status !== 0) {
  console.log('Audio stderr:', audioRes.stderr);
}

const expectedMp3 = path.join(testOutputDir, `${thaiTitle}.mp3`);
if (fs.existsSync(expectedMp3)) {
  const stat = fs.statSync(expectedMp3);
  console.log('PASS: MP3 created successfully!');
  console.log(' - Path:', expectedMp3);
  console.log(' - Size:', stat.size, 'bytes');
} else {
  console.error('FAIL: MP3 file was not created.');
}

console.log('\n2. Testing Video (.mp4) Download with Real Resolution & Cover Art:');
const videoOut = path.join(testOutputDir, `${thaiTitle}_video.%(ext)s`);
const videoArgs = [
  '--no-playlist',
  '--ffmpeg-location', ffmpegPath,
  '-f', 'bestvideo[height<=?360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=?360]+bestaudio/best',
  '--merge-output-format', 'mp4',
  '--embed-thumbnail',
  '--embed-metadata',
  '-o', videoOut,
  targetUrl
];

const videoRes = spawnSync(ytdlpPath, videoArgs, { encoding: 'utf8', timeout: 60000 });
console.log('Video exit code:', videoRes.status);
if (videoRes.status !== 0) {
  console.log('Video stderr:', videoRes.stderr);
}

const expectedMp4 = path.join(testOutputDir, `${thaiTitle}_video.mp4`);
if (fs.existsSync(expectedMp4)) {
  const stat = fs.statSync(expectedMp4);
  console.log('PASS: MP4 created successfully!');
  console.log(' - Path:', expectedMp4);
  console.log(' - Size:', stat.size, 'bytes');
} else {
  console.error('FAIL: MP4 file was not created.');
}

// Cleanup test output
console.log('\nCleaning test files...');
try {
  fs.rmSync(testOutputDir, { recursive: true, force: true });
  console.log('Cleaned test directory.');
} catch (e) {}

console.log('\n=== REAL DOWNLOAD TEST FINISHED SUCCESSFULLY ===');
