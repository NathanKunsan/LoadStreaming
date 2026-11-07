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

  const renderVersionBadge = (versionNumber: string) => {
    if (updateInfo.currentVersion === versionNumber) {
      return (
        <span className="text-[10px] text-green-400 font-bold px-1.5 py-0.2 rounded bg-green-500/10 border border-green-500/30">
          {t.currentVersionBadge}
        </span>
      );
    }
    if (updateInfo.latestVersion === versionNumber && updateInfo.hasUpdate) {
      return (
        <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
          {language === 'th' ? 'เวอร์ชันใหม่ล่าสุด' : 'Latest'}
        </span>
      );
    }
    return null;
  };

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
            {/* Version 1.6.0 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.6.0' : 'Version 1.6.0'}</span>
                {renderVersionBadge('1.6.0')}
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>เพิ่มโหมดเครื่องเล่นสื่อในตัวแบบสมจริง แยกเป็นสี่หมวดหมู่ ได้แก่ ทีวีจอตู้สำหรับตลับวิดีโอ เครื่องเล่นแผ่นเสียงสำหรับแผ่นเพลงเดี่ยว เครื่องเล่นเทปคาสเซ็ทสำหรับม้วนเทปรวมเพลง และเครื่องเล่นพกพาวงล้อหมุน</li>
                    <li>เพิ่มระบบสังเคราะห์เสียงกลไกเชิงฟิสิกส์หลายชั้น จำลองเสียงใส่ตลับ มอเตอร์ดึงตลับ เปิดหลอดภาพ วางหัวเข็ม กดปุ่มเทป และหมุนวงล้อคลิก</li>
                    <li>เพิ่มระบบแจ้งเตือนตามตรงและเอฟเฟกต์อนุภาคสลายตัวเป็นผงฝุ่นเมื่อเลือกไฟล์ที่ถูกลบหรือย้ายออกจากเครื่อง</li>
                    <li>รองรับการฟังเพลงต่อเนื่องในพื้นหลังแม้สลับไปหน้าดาวน์โหลดหรือหน้าแปลงไฟล์ พร้อมแถบควบคุมย่อส่วน</li>
                  </>
                ) : (
                  <>
                    <li>Added built-in realistic Retro Media Player with four standalone categories: CRT TV Cartridge Deck, Direct-Drive Turntable, Stereo Cassette Mixtape Deck, and Pocket Click-Wheel Player.</li>
                    <li>Engineered multi-layered physical mechanical foley sound engine for cartridge motors, CRT tube static, tonearm stylus drop, latching piano keys, and piezo click wheel.</li>
                    <li>Added transparent missing-file disclosure followed by HTML5 Canvas particle disintegration when selecting deleted or moved files.</li>
                    <li>Added uninterrupted background audio playback across tabs with a persistent mini hardware transport bar.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.5.4 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.5.4' : 'Version 1.5.4'}</span>
                {renderVersionBadge('1.5.4')}
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>ปรับปรุงระบบอัปเดตแบบไร้รอยต่อ อัปเกรดแทนที่ไฟล์ในเครื่องอัตโนมัติในพื้นหลังโดยไม่เปิดหน้าต่างติดตั้งใหม่ยกชุด</li>
                    <li>รักษาค่าโฟลเดอร์จัดเก็บข้อมูลและคีย์ลัดเดิมไว้ครบถ้วน ไม่ต้องตั้งค่าใหม่หลังการอัปเดต</li>
                    <li>แก้ไขข้อจำกัดความละเอียด 360p ปลดล็อกการดึงข้อมูล 4K, 2K, 1080p และ 720p ของ YouTube ได้ครบทุกระดับ</li>
                    <li>เพิ่มปุ่มและคีย์ลัด R บนวงล้อคีย์ลัด สำหรับสลับความละเอียดวิดีโอด่วนได้ใน 0ms</li>
                    <li>เพิ่มปุ่มเลือกความละเอียด 4K, 2K, 1080p, 720p และคีย์เวิร์ดสั่งงานด่วนบนบอท Discord</li>
                  </>
                ) : (
                  <>
                    <li>Seamless in-place updater upgrade: update installs directly in the background without launching the setup wizard.</li>
                    <li>Preserved destination folders and user configurations across updates without setup prompts.</li>
                    <li>Resolved YouTube 360p limitation, unlocking 4K, 2K, 1080p, and 720p stream formats.</li>
                    <li>Quick resolution toggle badge in Radial Menu with R key shortcut.</li>
                    <li>Interactive resolution selection buttons and chat quality triggers in Discord Remote Bot.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.5.3 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.5.3' : 'Version 1.5.3'}</span>
                {renderVersionBadge('1.5.3')}
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>เชื่อมต่อบอทบนคลาวด์อัตโนมัติ 24 ชั่วโมง พร้อมแสดงเปอร์เซ็นต์ ความเร็ว ขนาดไฟล์ และเวลาคงเหลือแบบสดบน Discord</li>
                    <li>ปุ่มควบคุมการดาวน์โหลดบน Discord สั่งหยุดชั่วคราว ดาวน์โหลดต่อ หรือยกเลิกงานได้ทันที</li>
                    <li>ปุ่มเลือกประเภทไฟล์ MP4 (วิดีโอ) และ MP3 (เสียง) พร้อมแยกโฟลเดอร์จัดเก็บให้อัตโนมัติ</li>
                    <li>ตัวเลือกลิงก์เพลย์ลิสต์ สามารถเลือกดาวน์โหลดเฉพาะคลิปนี้ หรือโหลดทั้งชุด เพื่อป้องกันการโหลดเพลงทั้งหมดใน YouTube Mix โดยไม่ตั้งใจ</li>
                    <li>ปรับปรุงการดึงข้อมูลคลิปให้สมบูรณ์ก่อนบันทึก ป้องกันปัญหาไฟล์ถูกตั้งชื่อเป็นข้อความชั่วคราว</li>
                  </>
                ) : (
                  <>
                    <li>Automatic 24/7 cloud bot connection with live progress bar, speed, size metrics, and ETA updates on Discord.</li>
                    <li>Interactive live download controls on Discord to pause, resume, or cancel active jobs remotely.</li>
                    <li>Format selection buttons for MP4 Video and MP3 Audio with automatic folder routing.</li>
                    <li>Playlist options to choose between single track and full playlist downloads, preventing accidental YouTube Mix batching.</li>
                    <li>Fixed metadata retrieval to ensure accurate filenames before writing to disk, eliminating placeholder filenames.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.5.0 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.5.0' : 'Version 1.5.0'}</span>
                {renderVersionBadge('1.5.0')}
              </div>
              <ul className="list-disc list-inside text-[var(--color-text-muted)] space-y-0.5 pt-1 text-[11px]">
                {language === 'th' ? (
                  <>
                    <li>รองรับการสั่งดาวน์โหลดระยะไกลผ่านระบบบอท ทั้งแบบส่งข้อมูลทันทีและระบบคิวรับคำสั่งอัตโนมัติ</li>
                    <li>ระบบสร้างห้องข้อความส่วนตัวอัตโนมัติเมื่อเข้าห้องเสียงที่กำหนด พร้อมตัดสายและป้องกันการสร้างห้องซ้ำ</li>
                    <li>ระบบคิวสำรองรองรับการบันทึกคำสั่งล่วงหน้าแม้ขณะปิดคอมพิวเตอร์ และจะเริ่มดาวน์โหลดทันทีเมื่อเปิดโปรแกรม</li>
                    <li>เพิ่มแถบการเชื่อมต่อระบบสั่งดาวน์โหลดระยะไกลในหน้าต่างตั้งค่า พร้อมแสดงสถานะการเชื่อมต่อ</li>
                  </>
                ) : (
                  <>
                    <li>Added remote download support via automated bot with real-time dispatch and background queueing.</li>
                    <li>Dynamic personal text channel creation upon joining the designated voice trigger with instant disconnect and duplicate prevention.</li>
                    <li>Offline queue buffer stores incoming jobs while the computer is turned off and initiates downloads upon opening the application.</li>
                    <li>Added remote download integration panel in Settings with live connection status.</li>
                  </>
                )}
              </ul>
            </div>

            {/* Version 1.4.3 */}
            <div>
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.4.3' : 'Version 1.4.3'}</span>
                {renderVersionBadge('1.4.3')}
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
              <div className="flex items-center justify-between font-bold text-[var(--color-accent)] pb-0.5 border-b border-[var(--color-border)]/50">
                <span>{language === 'th' ? 'เวอร์ชัน 1.4.0' : 'Version 1.4.0'}</span>
                {renderVersionBadge('1.4.0')}
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
