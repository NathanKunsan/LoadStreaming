import https from 'https';
import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';
import { spawn } from 'child_process';
import { UpdateInfo } from './types';

export class UpdateManager {
  private updateServerUrl: string = 'https://api.github.com/repos/LoadStreaming/LoadStreaming/releases/latest';
  private tempInstallerPath: string;

  constructor() {
    this.tempInstallerPath = path.join(app.getPath('temp'), 'LoadStreaming-Update-Setup.exe');
  }

  public async checkForUpdates(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion();

    const checkLocalFallback = (): UpdateInfo => {
      const candidates = [
        'D:\\make_website\\LoadStreaming\\release\\LoadStreaming Setup.exe',
        path.join(process.cwd(), 'release', 'LoadStreaming Setup.exe'),
        path.join(__dirname, '../../release/LoadStreaming Setup.exe'),
        path.join(path.dirname(process.execPath), 'LoadStreaming Setup.exe'),
        path.join(app.getPath('downloads'), 'LoadStreaming Setup.exe'),
        path.join(app.getPath('desktop'), 'LoadStreaming Setup.exe')
      ];
      const found = candidates.find(p => fs.existsSync(p));
      if (found) {
        let latestVersion = '1.3.5';
        const pkgPath = 'D:\\make_website\\LoadStreaming\\package.json';
        if (fs.existsSync(pkgPath)) {
          try {
            const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkgData.version) {
              latestVersion = pkgData.version;
            }
          } catch {}
        }

        const isNewer = this.isVersionNewer(latestVersion, currentVersion);
        return {
          hasUpdate: isNewer,
          currentVersion,
          latestVersion,
          downloadUrl: found,
          releaseNotes: `พร้อมติดตั้งเวอร์ชันล่าสุด ${latestVersion}`
        };
      }
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseNotes: ''
      };
    };

    return new Promise((resolve) => {
      const options = {
        headers: {
          'User-Agent': `LoadStreaming-App/${currentVersion}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.get(this.updateServerUrl, options, (res) => {
        if (res.statusCode !== 200) {
          return resolve(checkLocalFallback());
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const latestTag = (release.tag_name || '').replace(/^v/, '');
            
            const isNewer = this.isVersionNewer(latestTag, currentVersion);
            let downloadUrl = '';

            if (release.assets && Array.isArray(release.assets)) {
              const exeAsset = release.assets.find((a: any) => a.name && a.name.endsWith('.exe'));
              if (exeAsset) {
                downloadUrl = exeAsset.browser_download_url;
              }
            }

            resolve({
              hasUpdate: isNewer,
              latestVersion: latestTag || currentVersion,
              currentVersion,
              releaseNotes: release.body || '',
              downloadUrl: downloadUrl || release.html_url
            });
          } catch (e) {
            resolve(checkLocalFallback());
          }
        });
      });

      req.on('error', () => {
        resolve(checkLocalFallback());
      });

      req.setTimeout(3500, () => {
        req.destroy();
        resolve(checkLocalFallback());
      });
    });
  }

  public async downloadAndApplyUpdate(
    downloadUrl: string,
    onProgress: (percent: number) => void
  ): Promise<boolean> {
    if (!downloadUrl) return false;

    // If local file path exists, copy and run silent install immediately
    if (fs.existsSync(downloadUrl)) {
      onProgress(30);
      try {
        fs.copyFileSync(downloadUrl, this.tempInstallerPath);
        onProgress(80);
        setTimeout(() => {
          onProgress(100);
          spawn(this.tempInstallerPath, ['/S'], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          setTimeout(() => {
            app.quit();
          }, 1000);
        }, 400);
        return true;
      } catch (err) {
        shell.openPath(downloadUrl);
        return true;
      }
    }

    // If it's a direct .exe link
    if (downloadUrl.endsWith('.exe')) {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(this.tempInstallerPath);
        
        const followRedirect = (url: string) => {
          https.get(url, { headers: { 'User-Agent': 'LoadStreaming-Updater' } }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return followRedirect(res.headers.location);
            }

            if (res.statusCode !== 200) {
              file.close();
              return reject(new Error(`Failed with HTTP ${res.statusCode}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let receivedBytes = 0;

            res.on('data', (chunk) => {
              receivedBytes += chunk.length;
              if (totalBytes > 0) {
                const pct = Math.round((receivedBytes / totalBytes) * 100);
                onProgress(pct);
              }
            });

            res.pipe(file);

            file.on('finish', () => {
              file.close(() => {
                // Execute installer and quit current app
                try {
                  spawn(this.tempInstallerPath, ['/S'], {
                    detached: true,
                    stdio: 'ignore'
                  }).unref();
                  setTimeout(() => {
                    app.quit();
                  }, 1000);
                  resolve(true);
                } catch (err) {
                  shell.openPath(this.tempInstallerPath);
                  resolve(true);
                }
              });
            });
          }).on('error', (err) => {
            file.close();
            reject(err);
          });
        };

        followRedirect(downloadUrl);
      });
    } else {
      // If release page url, open in browser
      shell.openExternal(downloadUrl);
      return true;
    }
  }

  private isVersionNewer(latest: string, current: string): boolean {
    if (!latest || !current) return false;
    const lParts = latest.split('.').map(n => parseInt(n, 10) || 0);
    const cParts = current.split('.').map(n => parseInt(n, 10) || 0);
    
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }
}
