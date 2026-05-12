@echo off
REM ====================================================================
REM Sport - START (avvio quotidiano)
REM
REM Assume che install.bat sia stato eseguito su questa macchina.
REM Avvia il dev server Next.js su http://localhost:3000.
REM Premi Ctrl+C per terminare.
REM ====================================================================

setlocal
pushd "%~dp0"

echo.
echo ====================================
echo  Sport - AVVIO LOCALE
echo ====================================
echo.

REM --- Verifica install.bat e' stato eseguito ---
if not exist "node_modules\next\package.json" (
    echo [ERRORE] node_modules\next non trovato. Esegui install.bat prima.
    pause
    exit /b 1
)
if not exist ".env" (
    echo [ERRORE] .env non trovato. Esegui install.bat prima.
    pause
    exit /b 1
)
if not exist "prisma\data\dev.db" (
    echo [ATTENZIONE] DB SQLite non trovato. Verra' creato al primo avvio.
)

echo Avvio dev server su http://localhost:3000
echo Premi Ctrl+C per terminare.
echo.
call npm run dev
set EXITCODE=%ERRORLEVEL%

echo.
echo Server terminato con exit code %EXITCODE%.
popd
endlocal
exit /b %EXITCODE%
