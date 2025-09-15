#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Ensure PATH has common locations when run from Finder
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Self-repair permissions and quarantine flags for launchers
for f in "NOFX Tools.command" "Start NOFX.command" "Start DB + NOFX.command"; do
  chmod +x "$f" 2>/dev/null || true
  xattr -d com.apple.quarantine "$f" 2>/dev/null || true
done

say_msg(){ osascript -e "display notification \"$1\" with title \"NOFX Tools\"" >/dev/null 2>&1 || true; }

ask_list(){
  osascript <<'OSA'
set opts to {"Run tests","Commit & push to GitHub","Open Dashboard","Start App","Start + Open Dashboard","Backup Now","Restore Latest Backup","Restore Specific Backup","Quit"}
set resp to choose from list opts with prompt "What do you want to do?" default items {"Open Dashboard"} OK button name "OK" cancel button name "Cancel"
if resp is false then
  return ""
else
  return item 1 of resp as string
end if
OSA
}

run_tests(){
  npm test 2>&1 | tee test_output.log
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    say_msg "Tests passed!"
  else
    say_msg "Tests failed - check test_output.log"
  fi
  read -p "Press any key to continue..."
}

commit_and_push(){
  git add -A
  msg=$(osascript -e 'text returned of (display dialog "Commit message:" default answer "Updates")')
  [ -z "$msg" ] && exit 0
  git commit -m "$msg"
  git push origin main
  say_msg "Pushed to GitHub"
}

open_dashboard(){
  open "http://localhost:3000/ui/runs"
}

start_app(){
  # Kill existing processes on port 3000
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 1

  # Start the app
  npm run dev &
  echo "Starting NOFX app..."
  sleep 5
  say_msg "NOFX app started"
}

start_and_open(){
  start_app
  sleep 2
  open_dashboard
}

backup_now(){
  # Get a friendly label from user
  label=$(osascript -e 'text returned of (display dialog "Backup label (optional):" default answer "manual backup")')
  [ -z "$label" ] && label="manual backup"

  # Get current user
  user="${USER:-local-user}"

  # Call API to create backup
  response=$(curl -s -X POST "http://localhost:3000/backups" \
    -H "Content-Type: application/json" \
    -d "{\"label\":\"$label\",\"created_by\":\"$user\"}")

  if echo "$response" | grep -q '"id"'; then
    say_msg "Backup created successfully"
  else
    osascript -e 'display alert "Backup failed" message "Could not create backup."' || true
  fi
}

restore_latest(){
  # Get the latest backup
  latest=$(curl -s "http://localhost:3000/backups?limit=1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$latest" ]; then
    osascript -e 'display alert "No backups found" message "There are no backups to restore."' || true
    exit 0
  fi

  # Confirm restoration
  confirm=$(osascript -e 'button returned of (display dialog "This will restore the latest backup. Continue?" buttons {"Cancel", "Restore"} default button "Cancel")')
  [ "$confirm" != "Restore" ] && exit 0

  # Restore
  code=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://localhost:3000/backups/${latest}/restore")
  if [ "$code" = "200" ]; then
    say_msg "Restored latest backup"
  else
    osascript -e 'display alert "Restore failed" message "Could not restore backup."' || true
  fi
}

restore_specific(){
  # Get list of backups
  backups=$(curl -s "http://localhost:3000/backups?limit=20")

  # Parse and create selection list
  tmp=$(mktemp)
  echo "$backups" | grep -o '"id":"[^"]*".*?"label":"[^"]*".*?"created_at":"[^"]*"' | while read -r line; do
    id=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    label=$(echo "$line" | grep -o '"label":"[^"]*"' | cut -d'"' -f4)
    created=$(echo "$line" | grep -o '"created_at":"[^"]*"' | cut -d'"' -f4 | cut -dT -f1)
    echo "${label} (${created})|${id}" >> "$tmp"
  done

  if [ ! -s "$tmp" ]; then
    osascript -e 'display alert "No backups found" message "There are no backups to restore."' || true
    rm -f "$tmp"
    exit 0
  fi

  # Show selection dialog
  items=$(cat "$tmp" | cut -d'|' -f1 | tr '\n' ',' | sed 's/,$//')
  selId=$(osascript <<OSA
set itemList to {}
set AppleScript's text item delimiters to ","
set items to text items of "$items"
repeat with i in items
  set end of itemList to (i as string)
end repeat
set sel to choose from list itemList with prompt "Select backup to restore:" OK button name "Restore" cancel button name "Cancel"
if sel is false then return ""
set sel to item 1 of sel
set fileData to paragraphs of (do shell script "cat $tmp")
repeat with L in fileData
  set AppleScript's text item delimiters to "|"
  set parts to text items of L
  set lab to item 1 of parts
  if lab is sel then
    return item 2 of parts
  end if
end repeat
return ""
OSA
)

  rm -f "$tmp" || true
  [ -z "$selId" ] && exit 0

  # Restore selected backup
  code=$(curl -s -w "%{http_code}" -o /dev/null -X POST "http://localhost:3000/backups/${selId}/restore")
  if [ "$code" = "200" ]; then
    say_msg "Restored backup ${selId}"
  else
    osascript -e 'display alert "Restore failed" message "Server error."' || true
  fi
}

main(){
  choice=$(ask_list)
  case "$choice" in
    "Run tests") run_tests ;;
    "Commit & push to GitHub") commit_and_push ;;
    "Open Dashboard") open_dashboard ;;
    "Start App") start_app ;;
    "Start + Open Dashboard") start_and_open ;;
    "Backup Now") backup_now ;;
    "Restore Latest Backup") restore_latest ;;
    "Restore Specific Backup") restore_specific ;;
    *) exit 0 ;;
  esac
}

main "$@"
