using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace LoadStreamingUpdater
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UpdaterForm());
        }
    }

    public class UpdaterForm : Form
    {
        private Label lblHeaderTitle;
        private Label lblHeaderSubtitle;
        private Panel panelInfo;
        private Label lblInstalledPathLabel;
        private Label lblInstalledPathValue;
        private Label lblCurrentVersionLabel;
        private Label lblCurrentVersionValue;
        private Label lblLatestVersionLabel;
        private Label lblLatestVersionValue;
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnUpdate;
        private Button btnLaunch;
        private Button btnClose;

        private string installedDirectory = "";
        private string installedExePath = "";
        private string currentVersion = "ไม่พบ";
        private string latestVersion = "1.4.0";
        private string setupExePath = "";
        private string asarSourcePath = "";

        // Colors matching LoadStreaming theme
        private Color colorBg = Color.FromArgb(24, 24, 27);          // #18181b
        private Color colorSurface = Color.FromArgb(39, 39, 42);     // #27272a
        private Color colorBorder = Color.FromArgb(63, 63, 70);      // #3f3f46
        private Color colorAccent = Color.FromArgb(234, 179, 8);     // #eab308 (Yellow)
        private Color colorText = Color.FromArgb(244, 244, 245);       // #f4f4f5
        private Color colorMuted = Color.FromArgb(161, 161, 170);     // #a1a1aa
        private Color colorGreen = Color.FromArgb(74, 222, 128);      // #4ade80

        public UpdaterForm()
        {
            InitializeComponent();
            CheckEnvironment();
        }

        private void InitializeComponent()
        {
            this.SuspendLayout();

            this.Text = "LoadStreaming Updater";
            this.ClientSize = new Size(520, 390);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = colorBg;
            this.ForeColor = colorText;
            this.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular, GraphicsUnit.Point);

            // Title
            lblHeaderTitle = new Label();
            lblHeaderTitle.Text = "โปรแกรมอัปเดต LoadStreaming";
            lblHeaderTitle.Font = new Font("Segoe UI", 13F, FontStyle.Bold, GraphicsUnit.Point);
            lblHeaderTitle.ForeColor = colorAccent;
            lblHeaderTitle.Location = new Point(20, 18);
            lblHeaderTitle.AutoSize = true;
            this.Controls.Add(lblHeaderTitle);

            // Subtitle
            lblHeaderSubtitle = new Label();
            lblHeaderSubtitle.Text = "อัปเดตโปรแกรมเป็นเวอร์ชันล่าสุดโดยอัตโนมัติ ไม่ต้องตั้งค่าใหม่";
            lblHeaderSubtitle.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            lblHeaderSubtitle.ForeColor = colorMuted;
            lblHeaderSubtitle.Location = new Point(22, 45);
            lblHeaderSubtitle.AutoSize = true;
            this.Controls.Add(lblHeaderSubtitle);

            // Info Panel
            panelInfo = new Panel();
            panelInfo.Location = new Point(20, 75);
            panelInfo.Size = new Size(480, 160);
            panelInfo.BackColor = colorSurface;
            panelInfo.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(panelInfo);

            // Installed Path
            lblInstalledPathLabel = new Label();
            lblInstalledPathLabel.Text = "ตำแหน่งโปรแกรมในเครื่อง:";
            lblInstalledPathLabel.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold, GraphicsUnit.Point);
            lblInstalledPathLabel.ForeColor = colorMuted;
            lblInstalledPathLabel.Location = new Point(14, 14);
            lblInstalledPathLabel.AutoSize = true;
            panelInfo.Controls.Add(lblInstalledPathLabel);

            lblInstalledPathValue = new Label();
            lblInstalledPathValue.Text = "กำลังตรวจสอบ...";
            lblInstalledPathValue.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular, GraphicsUnit.Point);
            lblInstalledPathValue.ForeColor = colorText;
            lblInstalledPathValue.Location = new Point(14, 34);
            lblInstalledPathValue.Size = new Size(450, 32);
            lblInstalledPathValue.AutoEllipsis = true;
            panelInfo.Controls.Add(lblInstalledPathValue);

            // Current Version
            lblCurrentVersionLabel = new Label();
            lblCurrentVersionLabel.Text = "เวอร์ชันที่ติดตั้งอยู่:";
            lblCurrentVersionLabel.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold, GraphicsUnit.Point);
            lblCurrentVersionLabel.ForeColor = colorMuted;
            lblCurrentVersionLabel.Location = new Point(14, 75);
            lblCurrentVersionLabel.AutoSize = true;
            panelInfo.Controls.Add(lblCurrentVersionLabel);

            lblCurrentVersionValue = new Label();
            lblCurrentVersionValue.Text = "--";
            lblCurrentVersionValue.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
            lblCurrentVersionValue.ForeColor = colorText;
            lblCurrentVersionValue.Location = new Point(14, 96);
            lblCurrentVersionValue.AutoSize = true;
            panelInfo.Controls.Add(lblCurrentVersionValue);

            // Latest Version
            lblLatestVersionLabel = new Label();
            lblLatestVersionLabel.Text = "เวอร์ชันล่าสุดที่มี:";
            lblLatestVersionLabel.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold, GraphicsUnit.Point);
            lblLatestVersionLabel.ForeColor = colorMuted;
            lblLatestVersionLabel.Location = new Point(250, 75);
            lblLatestVersionLabel.AutoSize = true;
            panelInfo.Controls.Add(lblLatestVersionLabel);

            lblLatestVersionValue = new Label();
            lblLatestVersionValue.Text = "--";
            lblLatestVersionValue.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
            lblLatestVersionValue.ForeColor = colorGreen;
            lblLatestVersionValue.Location = new Point(250, 96);
            lblLatestVersionValue.AutoSize = true;
            panelInfo.Controls.Add(lblLatestVersionValue);

            // Status Label
            lblStatus = new Label();
            lblStatus.Text = "สถานะ: พร้อมสำหรับการทำงาน";
            lblStatus.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            lblStatus.ForeColor = colorText;
            lblStatus.Location = new Point(20, 245);
            lblStatus.Size = new Size(480, 22);
            this.Controls.Add(lblStatus);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(20, 272);
            progressBar.Size = new Size(480, 12);
            progressBar.Style = ProgressBarStyle.Blocks;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            // Button: Update Now
            btnUpdate = new Button();
            btnUpdate.Text = "อัปเดตทันที";
            btnUpdate.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold, GraphicsUnit.Point);
            btnUpdate.BackColor = colorAccent;
            btnUpdate.ForeColor = Color.Black;
            btnUpdate.FlatStyle = FlatStyle.Flat;
            btnUpdate.FlatAppearance.BorderSize = 0;
            btnUpdate.Location = new Point(20, 305);
            btnUpdate.Size = new Size(150, 38);
            btnUpdate.Cursor = Cursors.Hand;
            btnUpdate.Click += new EventHandler(this.BtnUpdate_Click);
            this.Controls.Add(btnUpdate);

            // Button: Launch LoadStreaming
            btnLaunch = new Button();
            btnLaunch.Text = "เปิดโปรแกรม";
            btnLaunch.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            btnLaunch.BackColor = colorSurface;
            btnLaunch.ForeColor = colorText;
            btnLaunch.FlatStyle = FlatStyle.Flat;
            btnLaunch.FlatAppearance.BorderColor = colorBorder;
            btnLaunch.Location = new Point(180, 305);
            btnLaunch.Size = new Size(130, 38);
            btnLaunch.Cursor = Cursors.Hand;
            btnLaunch.Click += new EventHandler(this.BtnLaunch_Click);
            this.Controls.Add(btnLaunch);

            // Button: Close
            btnClose = new Button();
            btnClose.Text = "ปิด";
            btnClose.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            btnClose.BackColor = colorSurface;
            btnClose.ForeColor = colorText;
            btnClose.FlatStyle = FlatStyle.Flat;
            btnClose.FlatAppearance.BorderColor = colorBorder;
            btnClose.Location = new Point(390, 305);
            btnClose.Size = new Size(110, 38);
            btnClose.Cursor = Cursors.Hand;
            btnClose.Click += (s, e) => { this.Close(); };
            this.Controls.Add(btnClose);

            this.ResumeLayout(false);
            this.PerformLayout();
        }

        private void CheckEnvironment()
        {
            // 1. Locate Installed Directory
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] possiblePaths = new string[]
            {
                Path.Combine(localAppData, @"Programs\LoadStreamingProgram"),
                Path.Combine(localAppData, @"Programs\LoadStreaming"),
                @"C:\Program Files\LoadStreamingProgram",
                @"C:\Program Files\LoadStreaming"
            };

            foreach (var p in possiblePaths)
            {
                string exe = Path.Combine(p, "LoadStreaming.exe");
                if (File.Exists(exe))
                {
                    installedDirectory = p;
                    installedExePath = exe;
                    break;
                }
            }

            if (!string.IsNullOrEmpty(installedExePath))
            {
                lblInstalledPathValue.Text = installedDirectory;
                try
                {
                    var versionInfo = FileVersionInfo.GetVersionInfo(installedExePath);
                    currentVersion = versionInfo.ProductVersion;
                    if (string.IsNullOrEmpty(currentVersion))
                    {
                        currentVersion = versionInfo.FileVersion;
                    }
                    if (currentVersion.EndsWith(".0"))
                    {
                        currentVersion = currentVersion.Substring(0, currentVersion.Length - 2);
                    }
                }
                catch
                {
                    currentVersion = "1.3.2";
                }
                lblCurrentVersionValue.Text = "v" + currentVersion;
            }
            else
            {
                lblInstalledPathValue.Text = "ไม่พบตำแหน่งติดตั้งโปรแกรมในระบบ";
                lblCurrentVersionValue.Text = "ยังไม่ได้ติดตั้ง";
                btnLaunch.Enabled = false;
            }

            // 2. Locate Latest Source/Setup File
            string[] setupCandidates = new string[]
            {
                @"D:\make_website\LoadStreaming\release\LoadStreaming Setup.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), @"Downloads\LoadStreaming Setup.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "LoadStreaming Setup.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"release\LoadStreaming Setup.exe")
            };

            foreach (var s in setupCandidates)
            {
                if (File.Exists(s))
                {
                    setupExePath = s;
                    break;
                }
            }

            // Check unpacked asar source
            string asarCandidate = @"D:\make_website\LoadStreaming\release\win-unpacked\resources\app.asar";
            if (File.Exists(asarCandidate))
            {
                asarSourcePath = asarCandidate;
            }

            // Check package.json for exact version
            string pkgPath = @"D:\make_website\LoadStreaming\package.json";
            if (File.Exists(pkgPath))
            {
                try
                {
                    string content = File.ReadAllText(pkgPath);
                    var match = Regex.Match(content, "\"version\":\\s*\"([^\"]+)\"");
                    if (match.Success)
                    {
                        latestVersion = match.Groups[1].Value;
                    }
                }
                catch {}
            }
            else if (!string.IsNullOrEmpty(setupExePath))
            {
                try
                {
                    var vInfo = FileVersionInfo.GetVersionInfo(setupExePath);
                    if (!string.IsNullOrEmpty(vInfo.ProductVersion))
                    {
                        latestVersion = vInfo.ProductVersion;
                    }
                }
                catch {}
            }

            lblLatestVersionValue.Text = "v" + latestVersion;

            if (currentVersion == latestVersion && !string.IsNullOrEmpty(installedExePath))
            {
                lblStatus.Text = "สถานะ: โปรแกรมเป็นเวอร์ชันล่าสุด (" + latestVersion + ") แล้ว";
                btnUpdate.Text = "อัปเดตซ้ำ";
            }
            else
            {
                lblStatus.Text = "สถานะ: มีการอัปเดตเวอร์ชันใหม่พร้อมติดตั้ง (" + latestVersion + ")";
                btnUpdate.Text = "อัปเดตทันที";
            }
        }

        private void BtnUpdate_Click(object sender, EventArgs e)
        {
            btnUpdate.Enabled = false;
            btnLaunch.Enabled = false;
            btnClose.Enabled = false;
            progressBar.Style = ProgressBarStyle.Marquee;

            Thread worker = new Thread(new ThreadStart(PerformUpdate));
            worker.IsBackground = true;
            worker.Start();
        }

        private void PerformUpdate()
        {
            try
            {
                // Step 1: Close running instances
                UpdateStatus("กำลังปิดโปรแกรม LoadStreaming ที่กำลังทำงานอยู่...");
                var processes = Process.GetProcessesByName("LoadStreaming");
                foreach (var p in processes)
                {
                    try
                    {
                        p.Kill();
                        p.WaitForExit(3000);
                    }
                    catch {}
                }
                Thread.Sleep(800);

                // Step 2: Perform update
                bool updated = false;

                // Priority 1: If full setup is available, run silent install
                if (!string.IsNullOrEmpty(setupExePath) && File.Exists(setupExePath))
                {
                    UpdateStatus("กำลังรันการอัปเดตผ่านตัวติดตั้ง (โหมดอัตโนมัติ)...");
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = setupExePath;
                    psi.Arguments = "/S";
                    psi.UseShellExecute = true;
                    var proc = Process.Start(psi);
                    if (proc != null)
                    {
                        proc.WaitForExit();
                        updated = true;
                    }
                }

                // Priority 2: Direct file sync / patch if setup not run or unpacked asar available
                if (File.Exists(asarSourcePath))
                {
                    // If target directory is identified
                    string targetDir = installedDirectory;
                    if (string.IsNullOrEmpty(targetDir))
                    {
                        targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\LoadStreamingProgram");
                    }

                    string targetResources = Path.Combine(targetDir, "resources");
                    if (Directory.Exists(targetResources))
                    {
                        UpdateStatus("กำลังปรับปรุงไฟล์แอปพลิเคชัน (app.asar)...");
                        string targetAsar = Path.Combine(targetResources, "app.asar");
                        File.Copy(asarSourcePath, targetAsar, true);
                        updated = true;
                    }
                }

                Thread.Sleep(1000);

                if (updated)
                {
                    this.Invoke((Action)(() =>
                    {
                        progressBar.Style = ProgressBarStyle.Blocks;
                        progressBar.Value = 100;
                        lblStatus.Text = "สถานะ: อัปเดตเป็นเวอร์ชัน " + latestVersion + " เสร็จสมบูรณ์แล้ว";
                        lblStatus.ForeColor = colorGreen;
                        btnUpdate.Enabled = true;
                        btnLaunch.Enabled = true;
                        btnClose.Enabled = true;
                        CheckEnvironment();
                        MessageBox.Show(
                            "อัปเดต LoadStreaming เป็นเวอร์ชัน " + latestVersion + " เรียบร้อยสมบูรณ์แล้ว",
                            "การอัปเดตสำเร็จ",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );
                    }));
                }
                else
                {
                    this.Invoke((Action)(() =>
                    {
                        progressBar.Style = ProgressBarStyle.Blocks;
                        progressBar.Value = 0;
                        lblStatus.Text = "สถานะ: ไม่พบไฟล์อัปเดตสำหรับดำเนินการ";
                        btnUpdate.Enabled = true;
                        btnLaunch.Enabled = true;
                        btnClose.Enabled = true;
                        MessageBox.Show(
                            "ไม่พบไฟล์ติดตั้งหรือไฟล์อัปเดตในระบบ โปรดตรวจสอบว่ามีไฟล์ LoadStreaming Setup.exe อยู่ในโฟลเดอร์ release หรือ Downloads",
                            "ไม่พบไฟล์อัปเดต",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                    }));
                }
            }
            catch (Exception ex)
            {
                this.Invoke((Action)(() =>
                {
                    progressBar.Style = ProgressBarStyle.Blocks;
                    progressBar.Value = 0;
                    lblStatus.Text = "สถานะ: เกิดข้อผิดพลาดในการอัปเดต";
                    btnUpdate.Enabled = true;
                    btnLaunch.Enabled = true;
                    btnClose.Enabled = true;
                    MessageBox.Show(
                        "เกิดข้อผิดพลาด: " + ex.Message,
                        "ข้อผิดพลาด",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }));
            }
        }

        private void UpdateStatus(string message)
        {
            if (this.InvokeRequired)
            {
                this.Invoke((Action)(() => { lblStatus.Text = "สถานะ: " + message; }));
            }
            else
            {
                lblStatus.Text = "สถานะ: " + message;
            }
        }

        private void BtnLaunch_Click(object sender, EventArgs e)
        {
            if (!string.IsNullOrEmpty(installedExePath) && File.Exists(installedExePath))
            {
                Process.Start(installedExePath);
                this.Close();
            }
            else
            {
                CheckEnvironment();
                if (!string.IsNullOrEmpty(installedExePath) && File.Exists(installedExePath))
                {
                    Process.Start(installedExePath);
                    this.Close();
                }
                else
                {
                    MessageBox.Show("ไม่พบไฟล์ LoadStreaming.exe ที่ติดตั้งไว้", "แจ้งเตือน", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
        }
    }
}
