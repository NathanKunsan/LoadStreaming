// scripts/download-binaries.js
// Downloads standalone yt-dlp.exe, ffmpeg.exe, and ffprobe.exe for LoadStreaming Windows bundling

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const BIN_DIR = path.join(__dirname, '..', 'resources', 'bin');

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url} -> ${destPath}`);
    const file = fs.createWriteStream(destPath);
    
    function requestWithRedirects(currentUrl) {
      https.get(currentUrl, {
        headers: { 'User-Agent': 'LoadStreaming-Downloader' }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return requestWithRedirects(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Failed to download ${currentUrl}: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    requestWithRedirects(url);
  });
}

async function main() {
  const ytdlpPath = path.join(BIN_DIR, 'yt-dlp.exe');
  const ffmpegPath = path.join(BIN_DIR, 'ffmpeg.exe');
  const ffprobePath = path.join(BIN_DIR, 'ffprobe.exe');

  console.log('Ensuring binary tools are available in:', BIN_DIR);

  // 1. yt-dlp.exe
  if (!fs.existsSync(ytdlpPath)) {
    console.log('Downloading yt-dlp.exe...');
    await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytdlpPath);
    console.log('yt-dlp.exe downloaded successfully.');
  } else {
    console.log('yt-dlp.exe already present.');
  }

  // 2. ffmpeg.exe & ffprobe.exe
  if (!fs.existsSync(ffmpegPath) || !fs.existsSync(ffprobePath)) {
    console.log('Downloading FFmpeg Windows package...');
    const zipPath = path.join(BIN_DIR, 'ffmpeg-release.zip');
    // Using official GitHub yt-dlp static build of ffmpeg
    const ffmpegZipUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
    
    try {
      await downloadFile(ffmpegZipUrl, zipPath);
      console.log('Extracting ffmpeg.exe & ffprobe.exe...');
      // Extract using powershell Expand-Archive
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${BIN_DIR}' -Force"`, { stdio: 'inherit' });
      
      // Locate ffmpeg.exe and ffprobe.exe in extracted folder
      const entries = fs.readdirSync(BIN_DIR, { withFileTypes: true });
      const extractedFolder = entries.find(e => e.isDirectory() && e.name.startsWith('ffmpeg-master'));
      if (extractedFolder) {
        const extractedBin = path.join(BIN_DIR, extractedFolder.name, 'bin');
        if (fs.existsSync(path.join(extractedBin, 'ffmpeg.exe'))) {
          fs.copyFileSync(path.join(extractedBin, 'ffmpeg.exe'), ffmpegPath);
        }
        if (fs.existsSync(path.join(extractedBin, 'ffprobe.exe'))) {
          fs.copyFileSync(path.join(extractedBin, 'ffprobe.exe'), ffprobePath);
        }
        // Remove extracted directory and zip to save space
        fs.rmSync(path.join(BIN_DIR, extractedFolder.name), { recursive: true, force: true });
      }
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      console.log('FFmpeg binaries installed successfully.');
    } catch (err) {
      console.error('Error downloading/extracting ffmpeg package:', err);
    }
  } else {
    console.log('ffmpeg.exe & ffprobe.exe already present.');
  }

  console.log('All binary tools ready in', BIN_DIR);
}

main().catch(err => {
  console.error('Fatal in download-binaries:', err);
  process.exit(1);
});
