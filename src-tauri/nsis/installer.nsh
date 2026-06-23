!macro NSIS_HOOK_PREUNINSTALL
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否同时清除 InboxTray 的用户数据？$\r$\n$\r$\n清除后应用设置、数据库和图片将被永久删除，$\r$\n重装后不会保留，且无法恢复。" \
    /SD IDNO IDYES clearAppData
  Goto done
clearAppData:
  RMDir /r "$LOCALAPPDATA\com.inboxtray.app"
done:
!macroend
