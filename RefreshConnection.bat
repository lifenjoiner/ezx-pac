@echo off
setlocal ENABLEDELAYEDEXPANSION
pushd %~dp0

::-code-::
set /a N=0
for /f "usebackq skip=2 tokens=2 delims=: " %%i in (`netsh wlan show profiles`) do (
    set match=no
    for /f "usebackq skip=2 tokens=2 delims=: " %%a in (`netsh wlan show interfaces`) do (
        if "%%i"=="%%a" (set match=yes)
    )
    if  !match!==yes (
        set /a N+=1
        set Profile!N!=%%i
    )
)
::Just re-connect
for /L %%i in (1,1,%N%) do (
    call netsh wlan connect name=%%Profile!N!%%
)
::-code-::

:Exit
popd
endlocal
exit /b
