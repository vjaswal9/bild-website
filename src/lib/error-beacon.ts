// A tiny stand-in for browser-side Sentry.
//
// The real Sentry browser SDK was removed because it added 113 KB to every
// page. This is about 0.8 KB, inlined into the page, and does one thing: when
// the visitor's browser hits a JavaScript error, it posts a short note to
// /api/client-error, which passes it on to Sentry. It sends at most five
// distinct errors per page view, never anything the visitor typed, and only
// the page's path (never its query string or any link token, which the server
// also strips again).
//
// It is inline rather than a bundled component so that it is running before
// the app's own code, and so still reports when the app fails to start at all.
export const ERROR_BEACON_SCRIPT = `(function(){var n=0,seen={};function send(m,s,l,c,st){if(n>=5)return;var k=m+"|"+s+"|"+l;if(seen[k])return;seen[k]=1;n++;try{var b=JSON.stringify({m:String(m).slice(0,300),s:String(s||"").slice(0,200),l:l||0,c:c||0,st:String(st||"").slice(0,1500),p:location.pathname});if(navigator.sendBeacon){navigator.sendBeacon("/api/client-error",new Blob([b],{type:"text/plain"}))}else{fetch("/api/client-error",{method:"POST",body:b,keepalive:true,headers:{"Content-Type":"text/plain"}})}}catch(e){}}window.addEventListener("error",function(e){if(e.target&&e.target!==window)return;send(e.message,e.filename,e.lineno,e.colno,e.error&&e.error.stack)});window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("Unhandled rejection: "+(r&&r.message||r),"",0,0,r&&r.stack)});window.__bildReport=function(m,st){send(m,"react",0,0,st)}})();`

export type BrowserError = { m: string; s: string; l: number; c: number; st: string; p: string }

// Errors that say nothing about our own code. Reporting them would bury the
// real ones: broken extensions, flaky mobile connections, and scripts from
// other sites (Instagram embeds, analytics).
const IGNORED_MESSAGES = [
  /ResizeObserver loop/i,
  /^script error\.?$/i,
  /non-error promise rejection/i,
  /failed to fetch|load failed|networkerror|network request failed|fetch failed/i,
  /the operation was aborted|aborterror|the user aborted|request aborted/i,
  /importing a module script failed/i,
]
const EXTENSION = /^(chrome|moz|safari|safari-web|edge)-extension:/i

export function shouldIgnoreBrowserError(e: BrowserError, ourHosts: string[]): boolean {
  if (IGNORED_MESSAGES.some(re => re.test(e.m))) return true
  if (EXTENSION.test(e.s) || /(chrome|moz)-extension:\/\//i.test(e.st)) return true
  // A source file on some other host is somebody else's script.
  if (/^https?:\/\//i.test(e.s)) {
    try {
      const host = new URL(e.s).hostname
      if (!ourHosts.some(h => host === h || host.endsWith('.' + h))) return true
    } catch { return true }
  }
  return false
}
