# Fable 5.2: Termini + Faqja Gati (design, templates, then audit)
# Run:  powershell -ExecutionPolicy Bypass -File "F:\claude\work\kosovo-business\start-fable.ps1"
# If the limit runs out, run it again: it continues from fable/PROGRESS.md
Set-Location "F:\claude\work\kosovo-business"
New-Item -ItemType Directory -Force "fable" | Out-Null
claude --model claude-fable-5-2 "Read FABLE-BRIEF.md and CONTEXT.md in this folder and follow FABLE-BRIEF.md exactly. Check fable/PROGRESS.md first and continue from the first unfinished step. Save each file as soon as it is done."
