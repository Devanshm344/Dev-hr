@echo off
setlocal

echo Stopping Cotelligent HRMS + Alumni Network services...

for %%P in (8001 3000 8010 5174) do (
  for /f "tokens=5" %%A in ('netstat -aon ^| findstr :%%P ^| findstr LISTENING') do (
    echo   Killing process on port %%P (PID %%A^)
    taskkill /F /PID %%A >nul 2>&1
  )
)

echo Done.
