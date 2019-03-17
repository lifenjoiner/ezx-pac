# ezx-pac
ez (Easylist) + x (gfwlist) pac (Proxy Auto-Config) file template and auto generating (win) for IE/EDGE and firefox

homepage: https://github.com/lifenjoiner/ezx-pac

## Files
|file                   |comments                           |
|-----------------------|-----------------------------------|
|ezx-pac_auto-pac.js    |<- auto generating script, run this|
|ezx-pac_blacklist.txt  |local list setting block rules     |
|ezx-pac_locxlist.txt   |local list setting extra gfwlist   |
|ezx-pac_tmp.pac        |<- the template                    |
|LICENSE                |                                   |
|README.md              |                                   |
|RefreshConnection.bat  |make the update take effect        |
|wget.bat               |help to get the wget in other location by full path    |

## Debug
IE: https://github.com/lifenjoiner/pacdbger

firefox: Ctrl+Shift+J, reload; https://github.com/pacparser/pacparser

## Requirements
The auto generating scripts is just tested/used on windows.

cscript.exe

base64: https://github.com/lifenjoiner/base64

wget: https://github.com/lifenjoiner/wget-for-windows

mongoose: https://github.com/cesanta/mongoose

## Release
Practical suit with executable binaries included: https://github.com/lifenjoiner/ezx-pac/releases

## Acknowledgement
ABP (v2.9.1): https://github.com/adblockplus/adblockpluscore

ss_gfw.pac: https://github.com/breakwa11/gfw_whitelist/tree/master/ssr
