# Overnight pipeline: Fable design -> Opus build -> Fable audit -> Opus fixes -> MORNING-REPORT.md
# Start: powershell -ExecutionPolicy Bypass -File "F:\claude\work\kosovo-business\run-overnight.ps1"
# Safe to re-run: every step checks whether it is already done.
# Permissions: file edits auto-accepted; shell limited to npm/npx/node/git status-type commands (no full bypass).

$ErrorActionPreference = "Continue"
$root = "F:\claude\work\kosovo-business"
Set-Location $root
New-Item -ItemType Directory -Force "fable","opus","build","logs" | Out-Null

# Keep the PC awake while this script runs (no system settings changed)
Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
[Win.Power]::SetThreadExecutionState(0x80000001) | Out-Null

$FABLE = "claude-fable-5-2"
$OPUS  = "claude-opus-5-5"
$NIGHT = " Roni is asleep: never ask questions, decide yourself and keep working until the step is fully done. Work only inside F:\claude\work\kosovo-business. Save files as you go."
$TOOLS = @("Read","Write","Edit","Glob","Grep","Bash(npm *)","Bash(npx *)","Bash(node *)","Bash(ls *)","Bash(mkdir *)","Bash(cp *)","Bash(cat *)")

function Log($msg) { $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg; Write-Host $line -ForegroundColor Cyan; Add-Content "$root\logs\pipeline.log" $line }

function Run-Claude($model, $prompt, $name) {
    Log "START $name ($model)"
    $log = "$root\logs\$name.log"
    # Prompt goes in through stdin: --allowedTools takes a list and would swallow a prompt placed after it
    ($prompt + $NIGHT) | & claude -p --model $model --permission-mode acceptEdits --allowedTools $TOOLS *>> $log
    Log "END $name exit=$LASTEXITCODE"
}

function Phase2Done { (Test-Path "$root\fable\PROGRESS.md") -and (Select-String -Path "$root\fable\PROGRESS.md" -Pattern "Phase 2 done" -Quiet) -and (Test-Path "$root\fable\templates") }
function BuildDone  { Test-Path "$root\READY-FOR-AUDIT.md" }
function AuditDone  { Test-Path "$root\fable\03-audit.md" }
function FixDone    { Test-Path "$root\MORNING-REPORT.md" }

# STEP 1: Fable design + templates (fallback: Opus stands in)
for ($i = 1; $i -le 1 -and -not (Phase2Done); $i++) {
    Run-Claude $FABLE "Read FABLE-BRIEF.md and CONTEXT.md and do PHASE 1 and PHASE 2 exactly as written. Check fable/PROGRESS.md first and continue from the first unfinished step. When Phase 2 is complete write the line 'Phase 2 done' in fable/PROGRESS.md and stop." "1-fable-design-$i"
}
for ($i = 1; $i -le 2 -and -not (Phase2Done); $i++) {
    Run-Claude $OPUS "Fable ran out of credits. You stand in for Fable: read FABLE-BRIEF.md and CONTEXT.md, check fable/PROGRESS.md and finish whatever is missing of PHASE 1 and PHASE 2 at the same premium quality. When complete write the line 'Phase 2 done' in fable/PROGRESS.md." "1-opus-design-$i"
}

# STEP 2: Opus builds the app
for ($i = 1; $i -le 2 -and -not (BuildDone); $i++) {
    Run-Claude $FABLE "Read OPUS-BUILD.md (you, Fable, are the builder now), CONTEXT.md and everything in fable/. Build the app exactly as OPUS-BUILD.md says (check build/ and opus/PROGRESS.md first and continue if partly done). Make npm run build and the tests pass. Finish by creating READY-FOR-AUDIT.md." "2-fable-build-$i"
}
for ($i = 1; $i -le 3 -and -not (BuildDone); $i++) {
    Run-Claude $OPUS "Read OPUS-BUILD.md, CONTEXT.md and everything in fable/. Build the app exactly as OPUS-BUILD.md says (check build/ and opus/PROGRESS.md first and continue if partly done). Make npm run build and the tests pass. Finish by creating READY-FOR-AUDIT.md." "2-opus-build-$i"
}

# STEP 3: Fable audit (fallback: Opus)
if (BuildDone) {
    # Fable may be at its usage limit: retry every 30 min until 07:30, then fall back to Opus
    $deadline = (Get-Date).Date.AddDays($(if ((Get-Date).Hour -ge 12) {1} else {0})).AddHours(7.5)
    $i = 1
    while (-not (AuditDone) -and (Get-Date) -lt $deadline) {
        Run-Claude $FABLE "READY-FOR-AUDIT.md exists. Read FABLE-BRIEF.md and do PHASE 3 (the audit of build/app) with all remaining effort. Also review the design and templates in fable/ (check fable/PROGRESS.md: parts may have been finished by Opus) and upgrade anything below your premium standard. Write fable/03-audit.md." "3-fable-audit-$i"
        if (-not (AuditDone)) { Log "Fable not available, retry in 30 min"; Start-Sleep -Seconds 1800 }
        $i++
    }
    if (-not (AuditDone)) {
        Run-Claude $OPUS "Fable is out of credits. Do PHASE 3 of FABLE-BRIEF.md yourself: a strict audit of build/app (UX at 375px, flows, security incl. preview bypass, bugs, Albanian copy). Write fable/03-audit.md." "3-opus-audit"
    }
}

# STEP 4: Opus fixes + morning report
if ((AuditDone) -and -not (FixDone)) {
    Run-Claude $FABLE "Read fable/03-audit.md. Fix every critical and high issue in build/app (and medium ones if quick). Run npm run build and the tests until they pass. Then write MORNING-REPORT.md in the root, in English, short and clear for Roni: what is ready, exact commands to run it, demo logins, what was done, what is still missing for launch (Paysera, domain, hosting, WhatsApp API) and the next 3 steps." "4-fable-fix"
}
if ((AuditDone) -and -not (FixDone)) {
    Run-Claude $OPUS "Read fable/03-audit.md. Fix every critical and high issue in build/app (and medium ones if quick). Run npm run build and the tests until they pass. Then write MORNING-REPORT.md in the root, in English, short and clear for Roni: what is ready, exact commands to run it, demo logins, what Fable and Opus did, what is still missing for launch (Paysera, domain, hosting, WhatsApp API) and the next 3 steps." "4-opus-fix"
}

Log "PIPELINE FINISHED. Phase2=$(Phase2Done) Build=$(BuildDone) Audit=$(AuditDone) Report=$(FixDone)"
[Win.Power]::SetThreadExecutionState(0x80000000) | Out-Null
