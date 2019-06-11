/* This include and eval public part of ezx-pac_tmp.pac */

//
$WshShell   = new ActiveXObject('WScript.Shell');
$cmd        = function(s){return /*controllable*/ $WshShell.Exec(s);}
$run        = function(s,t,r){return $WshShell.Run(s, t?t:10, r?r:false); /*?!url*/}
/*******/
try{WScript.StdOut.WriteLine()}catch(e){ //^_^ CLI. compiled?
    $run('cscript.exe //nologo "'+ WScript.ScriptFullName +'"');
    WScript.Quit();
}
//
$in     = WScript.StdIn;
$out    = WScript.StdOut;
$err    = WScript.StdErr;
$echo   = function(s){$out.Write(s)}
$msg    = function(s){$echo(s+'\n')}
$argv   = WScript.Arguments;
$is_dbg = $argv.Named.Exists('d');
$dsg    = function(s){ if ($is_dbg) {$msg(s)} }
//
$fso = new ActiveXObject('Scripting.FileSystemObject');
//
$textstream = function(p,m,n,t){return $fso.OpenTextFile(p, m?m:1, n?n:false, t?t:0)}
$newstream  = function(p,t){return $textstream(p, 2, true, t?t:0)}
$getstream_r  = function(p,t){return $textstream(p, 1, false, t?t:0)}
//
$readall= function(s,t){
    // 0:ANSI, -1:unicode, -2:system
    var f = $getstream_r(s,false, t?t:0);
    var s = f.ReadAll();
    f.Close();
    return s;
}
//
$cmd$ = function(s){ //not interactive
    var oExec = $cmd(s);
    var r = '';
    while (!oExec.StdOut.AtEndOfStream) {
        oExec.StdIn.Write('\x7F'); // DEL, Good?
        r += oExec.StdOut.ReadAll() || oExec.StdErr.ReadAll();
        WScript.Sleep(100);
    }
    return r;
}
/*******/
function get_html_text(url, dom_opr){
    var wget_plus = "cmd /c wget --timeout=30 --user-agent=Mozilla/5.0 -c -O -";
    
    var ret = $cmd$(wget_plus +" -t 3 " +url +(!dom_opr?"":(" |"+ dom_opr)));
    return ret;
}

/*******/
var Base64 = {
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	decode : function (input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;

		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

		while (i < input.length) {

			enc1 = this._keyStr.indexOf(input.charAt(i++));
			enc2 = this._keyStr.indexOf(input.charAt(i++));
			enc3 = this._keyStr.indexOf(input.charAt(i++));
			enc4 = this._keyStr.indexOf(input.charAt(i++));

			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;

			output = output + String.fromCharCode(chr1);

			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}

		}

		output = Base64._utf8_decode(output);

		return output;

	},

	_utf8_decode : function (utftext) {
		var string = "";
		var i = 0;
		var c = 0, c1 = 0, c2 = 0;

		while ( i < utftext.length ) {

			c = utftext.charCodeAt(i);

			if (c < 128) {
				string += String.fromCharCode(c);
				i++;
			}
			else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			}
			else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}

		}

		return string;
	}
};

/*******/
function textline2array(text) {
    text = text.replace(/\r\n/mg, "\n");
    text = text.replace(/\r/mg, "\n");
    return text.split("\n");
}

function removeemptyline(text) {
	return text.replace(/[\r\n]+/gm, "\n").replace(/^\n|\n$/gm, "");
}

function linesstr2arraystr(text) {
    text = text.replace(/'/gm, "\\'");
    text = textline2array(text);
    text = text.join("',\n'");
    text = "'"+ text +"'";
    return text;
}

function cleangfwliststr(text) {
    text = text.replace(/^[!\[].*$/gm, "");
    return removeemptyline(text);
}

function items2arraystr(items) {
	var items;
    items = items.join("\n");
    items = items.replace(/'/gm, "\\'");
    items = items.split("\n");
    return "[\n'"+ items.join("',\n'") +"'\n]";
}

/*******/
function get_gfw_result_str() {
    var text, tmp, result;
    var url;
    //
    url = "https://gitlab.com/gfwlist/gfwlist/raw/master/gfwlist.txt"; // 6h
    $msg(url);
    text = get_html_text(url, "");
    text = Base64.decode(text);
    $msg(text?"<got!":"<err?");
    //
    return text;
}

function get_locx_result_str() {
    var text, tmp, result;
    var url;
    //
    url = "http://127.0.0.1/ezx-pac_locxlist.txt"; // user define
    $msg(url);
    text = get_html_text(url, "");
    $msg(!text?"<err?":"<got!");
    //
    return text;
}

function mod_gfw_result_str(text) {
    var DelList = $readall(WScript.ScriptFullName.replace("_auto-pac.js", "_gfwlist_del.txt"));
    DelList =cleangfwliststr(DelList);
    DelList = DelList.split("\n");
    for (var i = 0; i < DelList.length; i++) {
        if (DelList[i] == "") continue;
        text = text.replace(DelList[i], "");
    }
    return text;
}

function get_gfw_result_items() {
	var text = get_gfw_result_str();
	text = mod_gfw_result_str(text);
	text += '\n'+ get_locx_result_str();
    text = cleangfwliststr(text);
    return textline2array(text);
}

/*******/
function get_blacklist_result_items() {
    var text, tmp, result;
    var url;
    //
    url = "http://127.0.0.1/ezx-pac_blacklist.txt"; // service provider injection
    $msg(url);
    text = get_html_text(url, "");
    $msg(!text?"<err?":"<got!");
    //
    text = cleangfwliststr(text);
    return textline2array(text);
}

/*******/
// https://easylist.to
// https://easylist-downloads.adblockplus.org/exceptionrules.txt
function access_host_items(items){
    if (!items) return [];
    var items_r = [];
    var items_w = [];
    var L = items.length;
    for (var i = 0; i < L; i++) {
        var filter = Filter.fromText(items[i]);
        if (filter.contentType == 268435391
        && !(filter.thirdParty || filter.domainSource || filter.matchCase || items[i].indexOf("[Adblock") == 0)
        ) {
            $dsg(items[i] +" [got]");
            if (filter instanceof BlockingFilter) {
                items_r.push(items[i]);
            }
            else if (filter instanceof WhitelistFilter) {
                items_w.push(items[i]);
            }
        }
    }
    // MUST be removed for releasing
    Filter.knownFilters = Object.create(null);
    //
    if (items_w.length) {
        items_r = ( items_r.join('\n') +'\n'+ items_w.join('\n') ).split('\n');
    }
    return items_r;
}

/* too many will make firefox "PAC Execution Error: uncaught exception: out of memory []"
8k (easylist) * 7k (gfwlist)
easylist_general_block.txt (>7.5k) is to many!?
use ff ad block addon.
*/
function get_easylist_result(){
    var text, tmp, result;
    var urls = [
    "https://github.com/easylist/easylist/raw/master/easylist/easylist_general_block.txt",
    "https://github.com/easylist/easylist/raw/master/easylist/easylist_general_block_dimensions.txt",
    "https://github.com/easylist/easylist/raw/master/easylist/easylist_adservers.txt",
    "https://github.com/easylist/easylist/raw/master/easylist/easylist_thirdparty.txt"
    ]; // 4d
    var url, L;
    //
    L = urls.length;
    text = "";
    for (var i = 0; i < L; i++) {
        url = urls[i];
		if (!url) continue;
        $msg(url);
        tmp = get_html_text(url, "");
        $msg(!tmp?"<err?":"<got!");
        //
        text += "\n"+ tmp;
    }
    //
    text = removeemptyline(text);
    text = textline2array(text);
    text = access_host_items(text);
    //
    return text;
}

function matcher_add_filters(MatcherX, items) {
	var L = items.length;
	for (var i = 0; i < L; i++) {
		if (items[i]) { // in case of ''
			MatcherX.add(Filter.fromText(items[i]));
		}
	}
    // MUST be removed for releasing
    Filter.knownFilters = Object.create(null);
    //
	return MatcherX;
}

function geturlhost(url) {
	var ret = '';
	if (url) {
		var r = /^[@|]*(\w*:\/\/|\/*)([\w\d\*\.-]*[\w\d\*]+\.[\w\d\*]+).*$/.exec(url);
		if (r) ret = r[2];
	}
	return ret;
}

//
function clean_direct_hosts(items_p, items_b) {
	if (!items_p || !items_p.length) return items_b;
	var ProxyListMatcher = new CombinedMatcher(); // use local var to reduce memory
	ProxyListMatcher = matcher_add_filters(ProxyListMatcher, items_p);
	var items_r = [];
	var items_rh = [];
	for (var i in items_b) {
		var host = geturlhost(items_b[i]);
		if (!host) {
			$dsg("[url]  " + items_b[i]);
			items_r.push( items_b[i] );
		}
		else if (ProxyListMatcher.matchesAny(host, 1, host) instanceof BlockingFilter) {
			$dsg("[host] " + items_b[i]);
			items_rh.push( items_b[i] );
		}
	}
	if (items_rh.length > 0) {
		items_r = ( items_r.join("\n") +"\n"+ items_rh.join("\n") ).split("\n");
	}
	//
	items_rh = null;
	ProxyListMatcher.clear();
	//
	return items_r;
}

function update_result(){
    var gfw_list = get_gfw_result_items();
    //
    var result_str = items2arraystr(gfw_list);
    if (result_str == '') {
        $msg("Update gfwlist failed, abort updates!");
        return;
    }
    data = data.replace("__RULES__", result_str);
    //
    var blacklist = get_blacklist_result_items();
    data = data.replace("__RULES_BLACKLIST__", items2arraystr(blacklist));
    //
    var easylist = get_easylist_result();
    easylist = clean_direct_hosts(gfw_list, easylist);
    var data_ms = data.replace("__RULES_EASYLIST_IN_GFW__", items2arraystr(easylist));
    //
    $dsg(data);
    var file = $newstream(file_out_ms);
    file.Write(data_ms);
    file.Close();
    //
    var data_ff = data.replace("__RULES_EASYLIST_IN_GFW__", "[]");
    //
    $dsg(data);
    file = $newstream(file_out_ff);
    file.Write(data_ff);
    file.Close();
    return 1;
}

/* *** */
$msg(new Date() +" [Start]");
var file_in = WScript.ScriptFullName.replace("_auto-pac.js", "_tmp.pac");
var file_out_ms = WScript.ScriptFullName.replace("_auto-pac.js", "_ms.pac");
var file_out_ff = WScript.ScriptFullName.replace("_auto-pac.js", "_ff.pac");
var filename_out_ms = WScript.ScriptName.replace("_auto-pac.js", "_ms.pac");
var filename_out_ff = WScript.ScriptName.replace("_auto-pac.js", "_ff.pac");
//
/* include and eval public part of ezx-pac_tmp.pac */
var data = $readall(file_in, 1);
eval( data.slice(0, data.indexOf("/* New instance */")) );
//
$run("httpd.exe", "0");
$msg("IE/EDGE url: http://127.0.0.1/"+ filename_out_ms);
$msg("firefox url: http://127.0.0.1/"+ filename_out_ff);
if ($run("ping -n 1 114.114.114.114", "0", true) != 0) { // hibernation
    $msg("Waiting 1 minute for connecting to network ...");
    WScript.Sleep(60000);
}
update_result();

data = null;

function deep_clean(Obj) {
    var e;
    for (var k in Obj) {
        try {deep_clean(Obj[k])} catch(e){}
        try {delete Obj[k]} catch(e){}
        try {Obj[k] = null} catch(e){}
    }
    try {delete Obj} catch(e){}
    try {Obj = null} catch(e){}
}

var helper_funs = ['extend', 'filterToRegExp', 'Filter', 'InvalidFilter', 'CommentFilter', 'ActiveFilter', 'RegExpFilter', 'BlockingFilter', 'WhitelistFilter', 'Matcher', 'CombinedMatcher'];
for (var i = 0; i < helper_funs.length; i++) {
    deep_clean(this[ helper_funs[i] ]);
}

var sleep_h = 7;
$msg(new Date());
$cmd("cmd /c RefreshConnection");
$cmd("cmd /c title auto-pac %time%");
$msg("Set use pac yourself! Win10 only accepts online pac!");
$msg(new Date() +" [Finished]");
$msg("Sleeping hours: "+ sleep_h);
WScript.Sleep(3600000 * sleep_h);
//in case of updates
$run('cscript.exe //nologo "'+ WScript.ScriptFullName +'"', 6);
