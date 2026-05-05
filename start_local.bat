@echo off
setlocal
pushd "%~dp0"

echo ====================================
echo SPORT PORTAL - AVVIO LOCALE
echo ====================================
echo.

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env mancante. Copio da .env.example come default.
        copy /Y ".env.example" ".env" >nul
    ) else (
        echo [ERRORE] Manca sia .env che .env.example.
        goto :error
    )
)

echo Controllo installazione dipendenze...
if not exist "node_modules\next\package.json" (
    echo Installazione dipendenze in corso, eseguo npm install...
    call npm install
    if errorlevel 1 goto :error
) else (
    echo Dipendenze gia' presenti, salto npm install.
)

echo.
echo Generazione Prisma Client...
call npx prisma generate
if errorlevel 1 goto :error

echo.
if exist "prisma\data\dev.db" (
    echo DB esistente trovato. Creo backup di sicurezza in dev.db.bak ...
    copy /Y "prisma\data\dev.db" "prisma\data\dev.db.bak" >nul
    echo I dati esistenti NON verranno cancellati.
) else (
    echo Primo avvio: il DB verra' creato in prisma\data\dev.db
)

echo.
echo Sincronizzazione schema DB SQLite (non distruttiva)...
call npx prisma db push
if errorlevel 1 goto :error

echo.
echo ====================================
echo Avvio dev server su http://localhost:3000
echo Premi Ctrl+C per terminare
echo ====================================
call npm run dev
set EXITCODE=%ERRORLEVEL%

echo.
echo Server terminato con exit code %EXITCODE%.
echo Premi un tasto per chiudere.
pause >nul
popd
endlocal
exit /b %EXITCODE%

:error
echo.
echo *** ERRORE durante l'avvio. Premi un tasto per chiudere. ***
pause >nul
popd
endlocal
exit /b 1
