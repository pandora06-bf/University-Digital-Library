@echo off
cd /d "%~dp0"
echo Dung va xoa database test cua ban Nhât...
docker compose down -v
echo Xong. Chay START_NHAT.cmd de khoi dong lai sach.
pause
