; build/installer.nsh
; Custom NSIS script for LoadStreaming:
; 1. Removes version number from bottom branding
; 2. Enforces /LoadStreamingProgram in destination folder
; 3. Provides default download location selection page before installation
; 4. Provides desktop shortcut selection checkbox page
; 5. Provides uninstall prompt for downloaded media folder (LoadStreaming)
; 6. 100% Pure English text

BrandingText "LoadStreaming"

InstallDir "C:\LoadStreamingProgram"

!macro preInit
  !ifndef BUILD_UNINSTALLER
    SetRegView 64
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\LoadStreamingProgram"
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\LoadStreamingProgram"
    SetRegView 32
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\LoadStreamingProgram"
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\LoadStreamingProgram"
  !endif
!macroend

!macro customInit
  !ifndef BUILD_UNINSTALLER
    ; Read previous installation directory from registry if available
    SetRegView 64
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $0 == ""
      ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${EndIf}
    ${If} $0 == ""
      SetRegView 32
      ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
      ${If} $0 == ""
        ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
      ${EndIf}
    ${EndIf}

    ${If} $0 != ""
    ${AndIf} ${FileExists} "$0\LoadStreaming.exe"
      StrCpy $INSTDIR $0
    ${Else}
      StrCpy $INSTDIR "C:\LoadStreamingProgram"
    ${EndIf}
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var DownloadLocationPage
Var DownloadLocationText
Var DownloadLocationPath
Var CreateDesktopShortcutCheckbox
Var CreateDesktopShortcutState

Function SanitizeInstallDir
  ; Trim trailing backslashes and forward slashes
  loop_trim:
    StrCpy $0 $INSTDIR "" -1
    ${If} $0 == "\"
    ${OrIf} $0 == "/"
      StrCpy $INSTDIR $INSTDIR -1
      Goto loop_trim
    ${EndIf}

  ; Check if $INSTDIR already ends with "LoadStreamingProgram" (length 20)
  StrLen $1 $INSTDIR
  ${If} $1 >= 20
    StrCpy $0 $INSTDIR "" -20
    ${If} $0 == "LoadStreamingProgram"
      Return
    ${EndIf}
  ${EndIf}

  ; Check if $INSTDIR ends with "LoadStreaming" (length 13)
  ${If} $1 >= 13
    StrCpy $0 $INSTDIR "" -13
    ${If} $0 == "LoadStreaming"
      StrCpy $INSTDIR $INSTDIR -13
      loop_trim2:
        StrCpy $0 $INSTDIR "" -1
        ${If} $0 == "\"
        ${OrIf} $0 == "/"
          StrCpy $INSTDIR $INSTDIR -1
          Goto loop_trim2
        ${EndIf}
      StrCpy $INSTDIR "$INSTDIR\LoadStreamingProgram"
      Return
    ${EndIf}
  ${EndIf}

  ; Otherwise, automatically append \LoadStreamingProgram
  StrCpy $INSTDIR "$INSTDIR\LoadStreamingProgram"
FunctionEnd

!macro customPageAfterChangeDir
  Page custom DownloadLocationPageCreate DownloadLocationPageLeave
  Page custom ShortcutPageCreate ShortcutPageLeave
!macroend

Function DownloadLocationPageCreate
  Call SanitizeInstallDir

  ; If this is an upgrade/re-install (LoadStreaming.exe exists in INSTDIR), skip this page completely
  ${If} ${FileExists} "$INSTDIR\LoadStreaming.exe"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $DownloadLocationPage
  ${If} $DownloadLocationPage == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 10u 100% 20u "Choose default download location for LoadStreaming media files:"
  Pop $0

  ${NSD_CreateLabel} 0 30u 100% 15u "The application will automatically create 'Video', 'Audio', and 'Converted' subfolders here:"
  Pop $0

  ${If} $DownloadLocationPath == ""
    StrCpy $DownloadLocationPath "$PROFILE\Downloads\LoadStreaming"
  ${EndIf}

  ${NSD_CreateText} 0 50u 75% 14u "$DownloadLocationPath"
  Pop $DownloadLocationText

  ${NSD_CreateButton} 78% 49u 22% 16u "Browse..."
  Pop $0
  ${NSD_OnClick} $0 OnBrowseDownloadLocation

  nsDialogs::Show
FunctionEnd

Function OnBrowseDownloadLocation
  nsDialogs::SelectFolderDialog "Select Default Download Folder" "$PROFILE\Downloads"
  Pop $0
  ${If} $0 != "error"
    ; Strip trailing slash if present
    StrCpy $1 $0 "" -1
    ${If} $1 == "\"
      StrCpy $0 $0 -1
    ${ElseIf} $1 == "/"
      StrCpy $0 $0 -1
    ${EndIf}
    StrCpy $DownloadLocationPath "$0\LoadStreaming"
    ${NSD_SetText} $DownloadLocationText "$DownloadLocationPath"
  ${EndIf}
FunctionEnd

Function DownloadLocationPageLeave
  ${NSD_GetText} $DownloadLocationText $DownloadLocationPath
  ${If} $DownloadLocationPath == ""
    StrCpy $DownloadLocationPath "$PROFILE\Downloads\LoadStreaming"
  ${EndIf}

  ; Fix double backslash after drive letter if present
  StrCpy $1 $DownloadLocationPath 3
  StrCpy $2 $DownloadLocationPath "" 3
  StrCpy $3 $1 "" 1
  ${If} $3 == ":\\"
    StrCpy $1 $1 2
    StrCpy $DownloadLocationPath "$1$2"
  ${EndIf}
FunctionEnd

Function ShortcutPageCreate
  ; If this is an upgrade/re-install, skip shortcut configuration page
  ${If} ${FileExists} "$INSTDIR\LoadStreaming.exe"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 10u 100% 20u "Choose shortcut options for LoadStreaming:"
  Pop $0

  ${NSD_CreateCheckbox} 0 35u 100% 14u "Create Desktop Shortcut"
  Pop $CreateDesktopShortcutCheckbox
  ${NSD_SetState} $CreateDesktopShortcutCheckbox ${BST_CHECKED}

  nsDialogs::Show
FunctionEnd

Function ShortcutPageLeave
  ${NSD_GetState} $CreateDesktopShortcutCheckbox $CreateDesktopShortcutState
FunctionEnd

!macro customInstall
  Call SanitizeInstallDir

  ; Only create or delete desktop shortcut if explicitly set on fresh install
  ${If} $CreateDesktopShortcutState == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\LoadStreaming.lnk" "$INSTDIR\LoadStreaming.exe" "" "$INSTDIR\LoadStreaming.exe" 0
  ${ElseIf} $CreateDesktopShortcutState == ${BST_UNCHECKED}
    Delete "$DESKTOP\LoadStreaming.lnk"
  ${Else}
    ; Upgrade mode: preserve or refresh existing desktop shortcut if it exists
    ${If} ${FileExists} "$DESKTOP\LoadStreaming.lnk"
      CreateShortCut "$DESKTOP\LoadStreaming.lnk" "$INSTDIR\LoadStreaming.exe" "" "$INSTDIR\LoadStreaming.exe" 0
    ${EndIf}
  ${EndIf}

  ; Only initialize default directories and default_download_dir.txt on fresh install
  ${If} $DownloadLocationPath != ""
    CreateDirectory "$DownloadLocationPath\Video"
    CreateDirectory "$DownloadLocationPath\Audio"
    CreateDirectory "$DownloadLocationPath\Converted"

    FileOpen $0 "$INSTDIR\default_download_dir.txt" w
    FileWrite $0 "$DownloadLocationPath"
    FileClose $0
  ${EndIf}
!macroend
!endif

; -------------------------------------------------------------
; Uninstaller Logic
; -------------------------------------------------------------
!ifdef BUILD_UNINSTALLER
!include "LogicLib.nsh"

Var DeleteDownloadDir
Var DownloadLocationToDelete

!macro customUnInit
  StrCpy $DeleteDownloadDir "0"
  StrCpy $DownloadLocationToDelete ""

  ; 1. Try reading saved download dir from default_download_dir.txt before INSTDIR is deleted
  ${If} ${FileExists} "$INSTDIR\default_download_dir.txt"
    FileOpen $0 "$INSTDIR\default_download_dir.txt" r
    ${If} $0 != 0
      FileRead $0 $DownloadLocationToDelete
      FileClose $0
    ${EndIf}
  ${EndIf}

  ; 2. Trim trailing whitespace, newline or carriage return from file read
  loop_trim_un:
    StrCpy $0 $DownloadLocationToDelete "" -1
    ${If} $0 == "$\r"
    ${OrIf} $0 == "$\n"
    ${OrIf} $0 == " "
      StrCpy $DownloadLocationToDelete $DownloadLocationToDelete -1
      Goto loop_trim_un
    ${EndIf}

  ; 3. Fallback to default download location if empty or file did not exist
  ${If} $DownloadLocationToDelete == ""
    ${If} ${FileExists} "$PROFILE\Downloads\LoadStreaming\*.*"
      StrCpy $DownloadLocationToDelete "$PROFILE\Downloads\LoadStreaming"
    ${EndIf}
  ${EndIf}

  ; 4. If download media folder exists, ask user whether to delete it or keep it
  ${If} $DownloadLocationToDelete != ""
  ${AndIf} ${FileExists} "$DownloadLocationToDelete\*.*"
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Do you want to also delete your downloaded media files folder ('LoadStreaming') and all files inside?$\r$\n$\r$\nFolder: $DownloadLocationToDelete$\r$\n$\r$\n- Choose 'Yes' to remove LoadStreamingProgram AND delete your downloaded media files.$\r$\n- Choose 'No' to remove LoadStreamingProgram but KEEP your downloaded media files." \
      IDNO keep_download_files
    StrCpy $DeleteDownloadDir "1"
    keep_download_files:
  ${EndIf}
!macroend

!macro customUnInstall
  ; LoadStreamingProgram ($INSTDIR) is automatically deleted by NSIS
  ; If user chose 'Yes', also delete the downloaded media folder LoadStreaming
  ${If} $DeleteDownloadDir == "1"
  ${AndIf} $DownloadLocationToDelete != ""
  ${AndIf} ${FileExists} "$DownloadLocationToDelete\*.*"
    RMDir /r "$DownloadLocationToDelete"
  ${EndIf}
!macroend
!endif
