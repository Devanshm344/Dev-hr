# ============================================================
#   Cotelligent HRMS + Alumni Network - Start Script (Windows)
#   Runs everything in THIS terminal. Ctrl+C reliably stops all
#   of it (unlike start.bat, which can't fully kill uvicorn's
#   reloader / npm's node children on Windows).
# ============================================================

$root = $PSScriptRoot

function Stop-Tree($processId) {
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$processId" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Tree $_.ProcessId }
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "  Starting Cotelligent HRMS + Alumni Network..." -ForegroundColor Cyan
Write-Host "  (Ctrl+C in this terminal stops everything, cleanly)" -ForegroundColor Cyan
Write-Host ""

# ── Free up the ports we're about to use (best-effort) ─────────────────────
foreach ($p in 8001, 3000, 8010, 5174) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

$procs = @()

$procs += Start-Process -FilePath "$root\backend\venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8001" `
    -WorkingDirectory "$root\backend" -NoNewWindow -PassThru

$procs += Start-Process -FilePath "$root\alumni-network\backend\venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8010" `
    -WorkingDirectory "$root\alumni-network\backend" -NoNewWindow -PassThru

Start-Sleep -Seconds 2

$procs += Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory "$root\frontend" -NoNewWindow -PassThru

$procs += Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" `
    -WorkingDirectory "$root\alumni-network\frontend" -NoNewWindow -PassThru

Write-Host ""
Write-Host "============================================================"
Write-Host "  Cotelligent HRMS is running (all output shows below):"
Write-Host ""
Write-Host "    HRMS Frontend    http://localhost:3000"
Write-Host "    HRMS Backend     http://localhost:8001   (docs: /docs)"
Write-Host ""
Write-Host "    Alumni Frontend  http://localhost:5174"
Write-Host "    Alumni Backend   http://localhost:8010   (docs: /docs)"
Write-Host "    (linked from the ""Alumni"" tile on HRMS's /modules page)"
Write-Host ""
Write-Host "  Press Ctrl+C to stop ALL of them."
Write-Host "============================================================"
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 1 }
}
finally {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    foreach ($p in $procs) {
        if ($p -and -not $p.HasExited) {
            Stop-Tree $p.Id
        }
    }
    Write-Host "Stopped." -ForegroundColor Yellow
}
