@echo off
setlocal ENABLEDELAYEDEXPANSION

::-code-::
if "%~1"=="" goto :Exit
:Lookup
for /f "usebackq delims=" %%i in ("%~dpn0.lst") do (
    echo %%i 1>&2
    if exist %%i (
        set app=%%i
    )
)
if "%app%"=="" (
	echo %~n0 path is not found, I'm repeating look for it in the %~n0.lst :p 1>&2
	pause
	goto :Lookup
)
"%app%" %*
::-code-::

:Exit
endlocal
exit /b
