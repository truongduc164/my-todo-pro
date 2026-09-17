@echo off
start http://127.0.0.1:8080
python "%~dp0main.py" serve
