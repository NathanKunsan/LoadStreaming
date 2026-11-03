; build/installer.nsh
; Custom NSIS script for LoadStreaming:
; 1. Removes version number from bottom branding
; 2. Provides default download location selection page before installation
; 3. Provides desktop shortcut selection checkbox page
; 4. 100% Pure English text

BrandingText "LoadStreaming"

!macro preInit
  !ifndef BUILD_UNINSTALLER
    SetRegView 64
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\LoadStreamingProgram"
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\LoadStreamingProgram"
    SetRegView 32
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\LoadStreamingProgram"
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\LoadStreamingProgram"
  !endif
!macroend

!macro customInit
  !ifndef BUILD_UNINSTALLER
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\LoadStreamingProgram"
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

!macro customPageAfterChangeDir
  Page custom DownloadLocationPageCreate DownloadLocationPageLeave
  Page custom ShortcutPageCreate ShortcutPageLeave
!macroend

Function DownloadLocationPageCreate
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
    ; Strip trailing slash if present (e.g. D:\ -> D: or C:\Folder\ -> C:\Folder)
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

  ; Fix double backslash after drive letter if present (e.g. D:\\ -> D:\)
  StrCpy $1 $DownloadLocationPath 3
  StrCpy $2 $DownloadLocationPath "" 3
  StrCpy $3 $1 "" 1
  ${If} $3 == ":\\"
    StrCpy $1 $1 2
    StrCpy $DownloadLocationPath "$1$2"
  ${EndIf}
FunctionEnd

Function ShortcutPageCreate
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
  ${If} $CreateDesktopShortcutState == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\LoadStreaming.lnk" "$INSTDIR\LoadStreaming.exe" "" "$INSTDIR\LoadStreaming.exe" 0
  ${Else}
    Delete "$DESKTOP\LoadStreaming.lnk"
  ${EndIf}

  ; Create default video, audio, and converted directories
  CreateDirectory "$DownloadLocationPath\Video"
  CreateDirectory "$DownloadLocationPath\Audio"
  CreateDirectory "$DownloadLocationPath\Converted"

  ; Save default download directory to installation folder
  FileOpen $0 "$INSTDIR\default_download_dir.txt" w
  FileWrite $0 "$DownloadLocationPath"
  FileClose $0
!macroend
!endif

