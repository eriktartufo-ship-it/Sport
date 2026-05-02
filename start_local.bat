@echo off
echo ====================================
echo SPORT PORTAL - AVVIO LOCALE
echo ====================================
echo.
echo Controllo installazione dipendenze...
if not exist node_modules\prisma (
    echo Installazione dipendenze in corso...
    call npm install
)

echo.
echo Generazione Prisma Client e Database...
call npx prisma generate
call npx prisma db push

echo.
echo Avvio del server di sviluppo...
call npm run dev
