@echo off
setlocal ENABLEDELAYEDEXPANSION

::-code-::
if "%~1"=="" goto :Exit
:Lookup
for /f "usebackq delims=" %%i in ("%~n0.lst") do (
    if exist %%i (
        set app=%%i
    )
)
if "%app%"=="" (
	title %~n0 path is not found, I'm repeating look for it in the %~n0.lst! :p
	pause
	goto :Lookup
)
"%app%" %*
::-code-::

:Exit
endlocal
exit /b
