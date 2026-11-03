import React from 'react';
import { DownloadCloud, CheckCircle, X, Sparkles } from 'lucide-react';
import { UpdateInfo } from '../../electron/types';
import { translations, Language } from '../locales/translations';

interface UpdateModalProps {
  language: Language;
  updateInfo: UpdateInfo | null;
  updateProgress: number | null;
  onClose: () => void;
  onInstall: (url: string) => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  language,
  updateInfo,
  updateProgress,
  onClose,
  onInstall
}) => {
  if (!updateInfo) return null;

  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="pencil-box max-w-lg w-full p-5 bg-[var(--color-surface)] text-[var(--color-text-main)] space-y-3.5 shadow-2xl border-2 border-[var(--color-border)]">
        {/* Header: Displays "รายการอัปเดต" / "Update Log" */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm tracking-wide">
              {updateInfo.hasUpdate ? t.updateAvailable : t.updateLogTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-3 text-xs">
          {/* Status Bar */}
          <div className="flex items-center justify-between p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
            <span className="font-bold">{t.updateStatusLabel}:</span>
            <strong className="text-green-400">
              {updateInfo.hasUpdate ? t.updateReadyLabel : t.updateCurrentLabel}
            </strong>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-[var(--color-text-muted)] font-mono">
            <span>{language === 'th' ? `เวอร์ชันปัจจุบัน: v${updateInfo.currentVersion}` : `Current: v${updateInfo.currentVersion}`}</span>
            {updateInfo.latestVersion && (
              <span>{language === 'th' ? `เวอร์ชันล่าสุด: v${updateInfo.latestVersion}` : `Latest: v${updateInfo.latestVersion}`}</span>
            )}
          </div>

          {/* Changelog Scrollable Container (Pure Thai / Pure English) */}
          <div className="max-h-56 overflow-y-auto p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs space-y-3 font-sans select-text">
            {/* Version 1.4.3 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.4.3' : 'Version 1.4.3'}</span>
                <span className="text-[10px] text-green-400">{t.currentVersionBadge}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ตัวติดตั้งจะเติมชื่อโฟลเดอร์สำหรับลงโปรแกรมต่อท้ายให้อัตโนมัติเสมอเมื่อเลือกเปลี่ยนไดรฟ์หรือโฟลเดอร์</li>
                    <li>ตัวถอนการติดตั้งเพิ่มคำถามยืนยัน เพื่อให้ผู้ใช้เลือกว่าจะลบโฟลเดอร์เก็บไฟล์ดาวน์โหลดด้วยหรือไม่ หรือจะเก็บรักษาไฟล์ไว้</li>
                    <li>สามารถเลือกนำไฟล์ที่เพิ่งแปลงเสร็จมาตั้งต้นเพื่อแปลงเป็นรูปแบบอื่นต่อได้ทันที ทั้งแบบรายไฟล์และทั้งชุด</li>
                    <li>สามารถเลือกรูปแบบไฟล์ปลายทางแยกเฉพาะสำหรับแต่ละไฟล์ในรายการเดียวกันได้อย่างอิสระ</li>
                    <li>เพิ่มความเร็วในการสั่งดาวน์โหลดจากวงล้อคีย์ลัด โดยรายการจะเข้าสู่คิวทันทีโดยไม่ต้องรอโหลดข้อมูล</li>
                  </>
                ) : (
                  <>
                    <li>Installer now automatically appends the application folder when changing drives or selecting a destination directory.</li>
                    <li>Uninstaller now asks whether to also delete the downloaded media folder or keep your saved files.</li>
                    <li>Added chained media conversion: easily continue converting completed files into other formats individually or in batch.</li>
                    <li>Per-file target format selector: choose different output formats for individual files within the same batch.</li>
                    <li>Instant radial menu queue dispatch: downloads enter the queue immediately without delay.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.4.0 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.4.0' : 'Version 1.4.0'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ระบบแนะนำแท็กและเลือกแยกโฟลเดอร์จัดเก็บอัตโนมัติตามชื่อตอนหรือหมวดหมู่ พร้อมให้สร้างหรือแก้ไขแท็กเองได้</li>
                    <li>รองรับการแปลงไฟล์คำบรรยายและข้อความรวม 10 รูปแบบในแท็บแปลงไฟล์</li>
                    <li>ตรวจจับลิงก์จากคลิปบอร์ดอัตโนมัติ พร้อมแจ้งเตือนให้กดดาวน์โหลดได้ทันที</li>
                    <li>วงล้อสั่งการด่วนด้วยคีย์ลัด เรียกใช้งานได้ทันใจ ปรับแต่งปุ่มและคำสั่งได้อิสระ ไม่กินทรัพยากรเครื่อง</li>
                    <li>รองรับการดึงวิดีโอทั่วไปและถ่ายทอดสด พร้อมจัดเตรียมโฟลเดอร์สำหรับไฟล์แปลงให้อัตโนมัติ</li>
                  </>
                ) : (
                  <>
                    <li>Smart tagging and folder routing based on video series or category with custom tag editing.</li>
                    <li>Supports 10 practical subtitle and transcript conversion formats in media converter.</li>
                    <li>Automatic clipboard link detection with instant download notification.</li>
                    <li>Quick radial hotkey menu overlay with customizable action slices and zero performance overhead.</li>
                    <li>Supports generic videos and live streams with automatic converted directory preparation.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.3.4 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.3.4' : 'Version 1.3.4'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ระบบตัดช่วงเวลาดาวน์โหลด กำหนดเวลาเริ่มและสิ้นสุดได้ทั้งคลิปเดี่ยวและรายคลิปในเพลย์ลิสต์</li>
                    <li>ระบบฝังภาพปกความละเอียดสูงและข้อมูลแท็กเพลงลงในไฟล์ MP3 โดยอัตโนมัติ</li>
                    <li>ระบบจำกัดความเร็วการดาวน์โหลด เพื่อควบคุมการใช้งานแบนด์วิดท์อินเทอร์เน็ต</li>
                  </>
                ) : (
                  <>
                    <li>Added time-range trim downloading for single videos and playlist items.</li>
                    <li>Added automatic high-resolution album cover art and ID3 tag embedding for MP3.</li>
                    <li>Added download speed limiter with configurable bandwidth options.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.3.3 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.3.3' : 'Version 1.3.3'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ปรับชื่อโฟลเดอร์ติดตั้งโปรแกรมเริ่มต้นในหน้าต่างติดตั้ง เพื่อความชัดเจนและแยกออกจากโฟลเดอร์ดาวน์โหลด</li>
                    <li>ปรับข้อความปุ่มย่อการทำงานเป็น "ย่อขนาด" ให้กระชับยิ่งขึ้น</li>
                  </>
                ) : (
                  <>
                    <li>Updated default installation directory to LoadStreamingProgram for clarity.</li>
                    <li>Shortened minimize button text to "Minimize".</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.3.2 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.3.2' : 'Version 1.3.2'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>รองรับการดาวน์โหลดเพลย์ลิสต์ พร้อมหน้าต่างเลือกรายการและจัดคิวดาวน์โหลดพร้อมกัน</li>
                    <li>เพิ่มระบบย่อโปรแกรมลงถาดระบบ พร้อมหน้าต่างยืนยันเมื่อกดปิด เพื่อให้ดาวน์โหลดต่อเนื่องในเบื้องหลัง</li>
                  </>
                ) : (
                  <>
                    <li>Added playlist downloader with item picker and batch queueing.</li>
                    <li>Added minimize to system tray with close confirmation modal.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.3.1 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.3.1' : 'Version 1.3.1'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>เพิ่มรูปแบบไฟล์วิดีโอยอดนิยม MP4 ในแท็บแปลงไฟล์สื่อ</li>
                    <li>ปรับค่าเริ่มต้นการแปลงวิดีโอเป็น MP4 ความละเอียดสูง</li>
                  </>
                ) : (
                  <>
                    <li>Added MP4 video format to media converter engine.</li>
                    <li>Set MP4 as default high-definition video target format.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.3.0 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.3.0' : 'Version 1.3.0'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>รองรับการเลือกและแปลงไฟล์พร้อมกันหลายรายการ</li>
                    <li>เพิ่มรูปแบบไฟล์เสียงยอดนิยม MP3 ในแท็บแปลงไฟล์สื่อ</li>
                    <li>ปรับปรุงระบบตรวจสอบและติดตั้งการอัปเดตแบบอัตโนมัติ</li>
                  </>
                ) : (
                  <>
                    <li>Added multi-file batch media conversion support.</li>
                    <li>Added MP3 audio format to media converter engine.</li>
                    <li>Enhanced in-app automatic update and installer handling.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.2.0 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.2.0' : 'Version 1.2.0'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>อัปเดตตัวแปลงไฟล์ให้เสถียรยิ่งขึ้น</li>
                    <li>ระบบตรวจจับไฟล์อัจฉริยะ ป้องกันการแปลงไฟล์เสียงข้ามไปเป็นวิดีโอ</li>
                    <li>ปรับปรุงการกรองไฟล์ให้แสดงเฉพาะนามสกุลที่เลือก</li>
                  </>
                ) : (
                  <>
                    <li>Enhanced Media Converter engine for improved stability.</li>
                    <li>Smart Auto-Detection: restricts audio files from being converted to video.</li>
                    <li>Specific file filters tailored directly to active media formats.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.1.0 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.1.0' : 'Version 1.1.0'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>เพิ่มระบบตรวจจับไฟล์ซ้ำ (ทำสำเนา, เปลี่ยนชื่อ, ยกเลิก)</li>
                    <li>เพิ่มระบบลากและวางลิงก์ พร้อมแอนิเมชันตอนวาง</li>
                    <li>เพิ่มแท็บแปลงไฟล์เสียงและวิดีโอ 20 รูปแบบ</li>
                    <li>เพิ่มหน้าเลือกตำแหน่งดาวน์โหลดในตัวติดตั้ง พร้อมแยกโฟลเดอร์วิดีโอและเสียงอัตโนมัติ</li>
                  </>
                ) : (
                  <>
                    <li>Added Duplicate File Detection (Make a copy, Rename, Cancel).</li>
                    <li>Added Drag & Drop URL support with animated drop zone.</li>
                    <li>Added Media Converter tab for audio and video formats.</li>
                    <li>Added download location selection in installer with auto video/audio separation.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.0.5 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.0.5' : 'Version 1.0.5'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ปรับตัวตั้งค่า installer ให้เสถียร</li>
                  </>
                ) : (
                  <>
                    <li>Improved installer settings and stability.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.0.0 */}
            <div>
              <div className="font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.0.0' : 'Version 1.0.0'}</span>
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>เริ่มสร้างโปรแกรม LoadStreaming สำหรับดาวน์โหลดวิดีโอและเสียงจากยูทูบ</li>
                    <li>ออกแบบหน้าต่างโปรแกรมสไตล์ลายเส้นดินสอ พร้อม 4 ธีมสี</li>
                    <li>ระบบคิวดาวน์โหลดพร้อมกัน 2 รายการ พร้อมปุ่มหยุดชั่วคราวและโหลดต่อ</li>
                  </>
                ) : (
                  <>
                    <li>Initial release of LoadStreaming downloader for YouTube video and audio.</li>
                    <li>Rough Pencil sketch UI design with 4 color themes.</li>
                    <li>2 concurrent download queues with Pause and Resume support.</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Download Progress Bar if updating */}
          {updateProgress !== null && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px]">
                <span>{t.updatingProgress}</span>
                <span className="font-mono">{updateProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-progress-bg)] overflow-hidden border border-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-progress-fill)] transition-all duration-200 rounded-full"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions with Special Thanks on the bottom left */}
        <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border)] gap-2">
          {/* Special Thanks on the bottom left (ตรงตำแหน่งที่วงกรอบสีแดงไว้) */}
          <div className="text-[11px] text-[var(--color-text-muted)] font-medium truncate select-text" title={t.specialThanks}>
            {t.specialThanks}
          </div>

          {/* Buttons on the bottom right */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="pencil-button-secondary px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              {t.closeBtn}
            </button>

            {updateInfo.hasUpdate && updateInfo.downloadUrl && updateProgress === null && (
              <button
                type="button"
                onClick={() => onInstall(updateInfo.downloadUrl!)}
                className="pencil-button px-4 py-1.5 text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{t.installUpdateBtn}</span>
              </button>
            )}

            {!updateInfo.hasUpdate && (
              <div className="flex items-center space-x-1 text-green-400 text-xs font-bold pl-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{t.updateCurrentLabel}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
