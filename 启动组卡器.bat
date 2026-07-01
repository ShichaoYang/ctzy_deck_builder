@echo off
cd /d "%~dp0"
echo 承天之弈 TY01 组卡器启动中...
echo 请不要关闭这个窗口。浏览器打开 http://127.0.0.1:5177/
start "" "http://127.0.0.1:5177/"
python -m http.server 5177 --bind 127.0.0.1
