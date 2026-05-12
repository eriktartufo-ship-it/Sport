@echo off
REM ====================================================================
REM Sport - INSTALL (one-time, post-clone su nuova macchina)
REM
REM Da lanciare UNA volta dopo aver clonato il repo o quando cambia PC.
REM Per l'avvio quotidiano usa start.bat.
REM
REM Prerequisiti host (NON installati da questo script):
REM   - Node 18+       https://nodejs.org/
REM   (SQLite e' embedded in Prisma — niente Postgres locale richiesto)
REM ====================================================================

setlocal
pushd "%~dp0"

echo.
echo ====================================
echo  Sport - INSTALL
echo ====================================
echo.

REM --- 1. Verifica tools host ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] Node non trovato in PATH. Installa Node 18+ da https://nodejs.org/
    goto :error
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] npm non trovato in PATH (dovrebbe arrivare con Node).
    goto :error
)

REM --- 2. .env ---
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env mancante, copio da .env.example
        copy /Y ".env.example" ".env" >nul
        echo [ATTENZIONE] Apri .env e cambia ADMIN_PASSWORD + JWT_SECRET prima di start.bat
    ) else (
        echo [ERRORE] Manca anche .env.example
        goto :error
    )
) else (
    echo .env gia' presente, skip.
)

REM --- 3. Node deps ---
if not exist "node_modules\next\package.json" (
    echo.
    echo Installazione dipendenze npm in corso...
    call npm install
    if errorlevel 1 goto :error
) else (
    echo Dipendenze gia' presenti, skip npm install.
)

REM --- 4. Prisma client ---
echo.
echo Generazione Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

REM --- 5. DB SQLite (sync schema, NON distruttivo) ---
echo.
if exist "prisma\data\dev.db" (
    echo DB esistente trovato: backup di sicurezza in dev.db.bak
    copy /Y "prisma\data\dev.db" "prisma\data\dev.db.bak" >nul
    echo I dati esistenti NON verranno cancellati.
) else (
    echo Primo avvio: il DB verra' creato in prisma\data\dev.db
)

echo Sincronizzazione schema DB SQLite...
call npx prisma db push
if errorlevel 1 goto :error

echo.
echo ============================================
echo  Install completato. Lancia start.bat
echo ============================================
echo.
popd
endlocal
exit /b 0

:error
echo.
echo *** ERRORE durante l'install. ***
pause
popd
endlocal
exit /b 1
