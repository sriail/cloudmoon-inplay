// Cloudflare Worker - CloudMoon Proxy with Tab Cloaking
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Serve PWA manifest
  if (url.pathname === '/manifest.json') {
    return new Response(getPWAManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Serve the main HTML page
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getMainHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Proxy everything else to CloudMoon
  return proxyCloudMoon(request);
}

async function proxyCloudMoon(request) {
  const url = new URL(request.url);
  
  // Build the target URL
  let targetURL;
  
  if (url.pathname.startsWith('/proxy/')) {
    const encodedURL = url.pathname.replace('/proxy/', '');
    targetURL = decodeURIComponent(encodedURL);
  } else {
    targetURL = 'https://web.cloudmoonapp.com' + url.pathname + url.search;
  }
  
  console.log('Proxying:', targetURL);
  
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(targetURL).host);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');
  
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }
  
  const proxyRequest = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'follow'
  });
  
  let response = await fetch(proxyRequest);
  
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', '*');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');
  
  const contentType = response.headers.get('Content-Type') || '';
  
  if (contentType.includes('text/html')) {
    let html = await response.text();
    
    const injectionCode = `
<script id="cm-fix-js">
(function(){
  function fixButtons() {
    var allBtns = document.querySelectorAll("button.google-button");
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      var styleAttr = btn.getAttribute("style") || "";
      
      // Check for purple background (123, 108, 196) - SHOW this button
      if (styleAttr.indexOf("123, 108, 196") !== -1 || styleAttr.indexOf("123,108,196") !== -1) {
        btn.style.setProperty("display", "flex", "important");
        btn.style.setProperty("visibility", "visible", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("pointer-events", "auto", "important");
        btn.style.setProperty("flex-direction", "row", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("gap", "1rem", "important");
        btn.style.setProperty("width", "min(350px, 100%)", "important");
        btn.style.setProperty("height", "45px", "important");
        btn.style.setProperty("border-radius", "5rem", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("font-size", "1rem", "important");
      }
      // Check for white background - HIDE this button (OAuth)
      else if (styleAttr.indexOf("255, 255, 255") !== -1 || styleAttr.indexOf("#fff") !== -1 || styleAttr.indexOf("white") !== -1 || btn.querySelector("svg")) {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
      }
    }
  }
  
  // Run immediately
  fixButtons();
  
  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixButtons);
  }
  
  // Run on window load
  window.addEventListener("load", fixButtons);
  
  // Run every 100ms
  setInterval(fixButtons, 100);
  
  // MutationObserver
  var observer = new MutationObserver(function() {
    fixButtons();
  });
  
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();
  
  // Intercept window.open for games
  var origOpen = window.open;
  window.open = function(u, t, f) {
    if (u && u.indexOf("run-site") > -1) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: "LOAD_GAME", url: u}, "*");
      } else {
        window.location.href = u;
      }
      return {closed: false, close: function(){}, focus: function(){}};
    }
    return origOpen.call(this, u, t, f);
  };
  
  console.log("[CloudMoon Fix] Initialized - JS only, no CSS hiding");
})();
</script>`;
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', injectionCode + '</head>');
    } else {
      html = injectionCode + html;
    }
    
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudMoon InPlay</title>
    <link rel="icon" id="favicon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☁️</text></svg>">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#2d2d2d">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CloudMoon">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            overflow: hidden;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        #header {
            background: #2d2d2d;
            padding: 12px 25px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border-bottom: 1px solid #404040;
        }
        
        #title {
            font-size: 18px;
            font-weight: 600;
            color: #e0e0e0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        #status {
            flex: 1;
            font-size: 14px;
            color: #a0a0a0;
        }
        
        button {
            background: #3a3a3a;
            color: #e0e0e0;
            border: none;
            padding: 7px 14px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        button:hover {
            background: #4a4a4a;
        }
        
        button:active {
            transform: scale(0.98);
        }
        
        #back-btn {
            display: none;
        }
        
        #tab-cloak-btn.active {
            background: #238636;
        }
        
        .icon {
            width: 16px;
            height: 16px;
        }
        
        #frame-container {
            flex: 1;
            width: 100%;
            background: white;
            position: relative;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            outline: none;
        }
        
        iframe:focus {
            outline: none;
        }
        
        #toast {
            position: fixed;
            top: 70px;
            right: 30px;
            background: #238636;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s;
            z-index: 999;
            font-weight: 500;
            font-size: 14px;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .navAutoHide #header {
            transform: translateY(-100%);
            transition: transform 0.25s ease;
        }
        
        .navAutoHide #header:hover,
        .navAutoHide #header.pinned {
            transform: translateY(0);
        }
        
        .navAutoHide #frame-container {
            height: 100vh;
        }
        
        #settingsOverlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1500;
        }
        
        #settingsOverlay.visible {
            display: flex;
        }
        
        #settingsPanel {
            background: #1e1e1e;
            border-radius: 24px;
            padding: 28px;
            width: 400px;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 12px 48px rgba(0,0,0,0.6);
            border: 1px solid #444;
        }
        
        .settingsHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #3a3a3a;
        }
        
        .settingsHeader h2 {
            margin: 0;
            font-size: 18px;
            color: #f0f0f0;
        }
        
        .closeSettingsBtn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px;
            color: #888;
        }
        
        .closeSettingsBtn:hover {
            color: #fff;
        }
        
        .settingGroup {
            margin-bottom: 18px;
        }
        
        .settingGroup label {
            display: block;
            font-size: 13px;
            color: #b0b0b0;
            margin-bottom: 6px;
        }
        
        .settingRow {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #2a2a2a;
        }
        
        .settingRow:last-child {
            border-bottom: none;
        }
        
        .settingLabel {
            font-size: 14px;
            color: #d0d0d0;
        }
        
        .toggleSwitch {
            position: relative;
            width: 44px;
            height: 24px;
        }
        
        .toggleSwitch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggleSlider {
            position: absolute;
            inset: 0;
            background: #444;
            border-radius: 24px;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .toggleSlider::before {
            content: '';
            position: absolute;
            width: 18px;
            height: 18px;
            left: 3px;
            top: 3px;
            background: #fff;
            border-radius: 50%;
            transition: transform 0.2s;
        }
        
        .toggleSwitch input:checked + .toggleSlider {
            background: #238636;
        }
        
        .toggleSwitch input:checked + .toggleSlider::before {
            transform: translateX(20px);
        }
        
        .settingInput {
            width: 100%;
            padding: 12px 16px;
            background: #2a2a2a;
            border: 1px solid #404040;
            border-radius: 12px;
            color: #e0e0e0;
            font-size: 13px;
        }
        
        .settingInput:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .settingSelect {
            width: 100%;
            padding: 12px 16px;
            background: #2a2a2a;
            border: 1px solid #404040;
            border-radius: 12px;
            color: #e0e0e0;
            font-size: 13px;
            cursor: pointer;
        }
        
        .panicBtn {
            background: #dc3545 !important;
            color: white !important;
            border-radius: 8px !important;
        }
        
        .panicBtn:hover {
            background: #c82333 !important;
        }
        
        .statusHidden #status {
            display: none;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="header">
            <div id="title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/>
                </svg>
                CloudMoon InPlay
            </div>
            <div id="status">Loading...</div>
            <button id="tab-cloak-btn" onclick="toggleTabCloak()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Tab Cloak
            </button>
            <button id="back-btn" onclick="goBack()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Back
            </button>
            <button onclick="openAboutBlank()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                about:blank
            </button>
            <button onclick="toggleFullscreen()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                </svg>
                Fullscreen
            </button>
            <button onclick="reloadFrame()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Reload
            </button>
            <button id="panicTrigger" class="panicBtn" onclick="triggerPanicMode()">
                <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>
                Panic
            </button>
            <button id="configTrigger" onclick="showConfigPanel()">
                <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>
                Settings
            </button>
        </div>
        <div id="frame-container"></div>
    </div>
    
    <div id="toast">
        Loading your Game / App...
    </div>
    
    <div id="settingsOverlay">
        <div id="settingsPanel">
            <div class="settingsHeader">
                <h2>Settings</h2>
                <button class="closeSettingsBtn" onclick="hideConfigPanel()">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="settingRow">
                <span class="settingLabel">Mute Notifications</span>
                <label class="toggleSwitch">
                    <input type="checkbox" id="cfgMuteNotifs" onchange="persistConfig()">
                    <span class="toggleSlider"></span>
                </label>
            </div>
            
            <div class="settingRow">
                <span class="settingLabel">Auto-hide Navigation</span>
                <label class="toggleSwitch">
                    <input type="checkbox" id="cfgAutoHideNav" onchange="persistConfig()">
                    <span class="toggleSlider"></span>
                </label>
            </div>
            
            <div class="settingRow">
                <span class="settingLabel">Hide Status Text</span>
                <label class="toggleSwitch">
                    <input type="checkbox" id="cfgHideStatus" onchange="persistConfig()">
                    <span class="toggleSlider"></span>
                </label>
            </div>
            
            <div class="settingRow">
                <span class="settingLabel">Use Blob Loading</span>
                <label class="toggleSwitch">
                    <input type="checkbox" id="cfgBlobMode" onchange="persistConfig()">
                    <span class="toggleSlider"></span>
                </label>
            </div>
            
            <div class="settingGroup">
                <label>Tab Disguise Mode</label>
                <select class="settingSelect" id="cfgDisguiseMode" onchange="persistConfig()">
                    <option value="classroom">Google Classroom</option>
                    <option value="drive">Google Drive</option>
                    <option value="docs">Google Docs</option>
                    <option value="none">None (Original)</option>
                </select>
            </div>
            
            <div class="settingGroup">
                <label>Panic Redirect URL</label>
                <input type="text" class="settingInput" id="cfgPanicUrl" placeholder="https://classroom.google.com" onchange="persistConfig()">
            </div>
            
            <div class="settingGroup">
                <label>Panic Keyboard Shortcut</label>
                <select class="settingSelect" id="cfgPanicKey" onchange="persistConfig()">
                    <option value="Escape">Escape Key</option>
                    <option value="Backquote">Backtick (~)</option>
                    <option value="F1">F1 Key</option>
                </select>
            </div>
        </div>
    </div>

    <script>
        const frameContainer = document.getElementById('frame-container');
        const status = document.getElementById('status');
        const backBtn = document.getElementById('back-btn');
        const toast = document.getElementById('toast');
        const tabCloakBtn = document.getElementById('tab-cloak-btn');
        
        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        let shadowRoot = null;
        let currentIframe = null;
        let isCloaked = false;
        
        const cmDefaultTitle = 'CloudMoon InPlay';
        const cmDefaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☁️</text></svg>";
        
        const appConfig = {
            muteNotifs: false,
            autoHideNav: false,
            hideStatus: false,
            blobMode: false,
            disguiseMode: 'classroom',
            panicUrl: 'https://classroom.google.com',
            panicKey: 'Escape'
        };
        
        const disguisePresets = {
            classroom: { title: 'Classes', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAADW0lEQVRYhb2XT0hUURTGf+fNm+bVNP4ZxRhKAxeVBLYoaBOEEkTQpk0EbVpEELRo1aKgRYQtItrUKqJ/i6BVRBCUQYsWYf9QMwoz0cxCZ3TmzX1vbgtnHI3RmXl64MPLvY9zv3vOueee71F+RMvuQ/d2CIwClh48WN/98U0+TwVA6e17dwM3gb1Axt8FjgEnwnqmNo9n/xdA6Z1HTUAncAzY5gMAnAL6gMOSqRsA7PkuTu+9d3eBl8BeYOs6q54CuoCj3hON5yXbsI6HL4BbwGHW//gAXcBR741G5QdwyJDyYpAgmNz0VztTqD87Zt7+vBiMbKC0vPZc4XmJf8d0z0pP/tPYr4s3PgwvADcAbxOxXoCqc9c3FZ9dHAcmCtWuO97w8q3+H6N/D3WlXqSmawl6OoFzQAl/SVXHh9oj/UOnL4HSpF6JPBGAW8Bp4B5wsEi+sxnoTRpgKzBayHj92r0twFRBv+cBFHi4kZPtCthRACtJAQSwOQGAwvV8IMkABjBlLQFYOgmAEdsaQBpbBEsCUDlgpwFMJ+RYAL6XAnCiWMFCfhqoAFbfibDzAIMvB4ZfFwigb8EGLnjPNw54zzU2A0PeC00HclXCRd+QUur3Pdu/tqkXwLNc7TQ1bU8AXT//qbDgfk9K5fKqp+E7sL+qqvofVYAL7nWnMTqC68D9X1Wkp+EHcGD1fSXi+/U0HAQe+SXIC59cZAA+/noBYlTPtdYnADDvvdCcD4C+S/feAH1/2P8ZePSrHf4OQHe+AJxwO9sTcFt+L5ALINfXuqTUMeBbvu6bC2AOOJHv8/vWE61jgj0J/AWvJz4Am8D5YgAorxjXfkD6/2M6rwnvhaZ2XdmGd+4HgZ68pJ/sePluEBjxnm9auw82HUCpu/eUUk/x++K/dsSGx/3fDrjgTM8SrWZA+f05rydaFwAclVx9T96K6PW0PZBE9fy67uN8vhHlx5t8Zyh83vwL5V+RTBF9wWy4AAC+t1rPAyfxu9S/WgC4o5R6opXeBNz0u9l15Xvjhc/yBYgAAMGU7/dRG1Dpr/8B+BLoO9yzYzp4f7MnXxPOC0Cp1s5ub5bQHlyAemCHP14KfAD6J/SJ5uDtpc+FeP8E0sLYXdZbKF8AAAAASUVORK5CYII=' },
            drive: { title: 'My Drive - Google Drive', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78"><path fill="%230066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 52.55H0c0 1.55.4 3.1 1.2 4.5l5.4 9.8z"/><path fill="%0000F" d="M43.65 25.55L29.9 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.35c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-26.3z"/><path fill="%0000F" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85L73.55 76.8z"/><path fill="%0000F" d="M43.65 25.55L57.4 0c-1.35-.8-2.9-1.2-4.5-1.2H34.4c-1.6 0-3.15.45-4.5 1.2l13.75 25.55z"/><path fill="%000F" d="M59.8 52.55H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L59.8 52.55z"/><path fill="%0000F" d="M73.4 26.5L57.4 0c-.8 1.4-1.95 2.5-3.3 3.3l-26.4 45.9 16.15 26.35h27.5c0-1.55-.4-3.1-1.2-4.5L55.5 52.55l17.9-26.05z"/></svg>' },
            docs: { title: 'Untitled document - Google Docs', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%234285F4" d="M29 4H12c-2.2 0-4 1.8-4 4v32c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4V15L29 4z"/><path fill="%23A1C2FA" d="M29 4v11h11z"/><path fill="%23fff" d="M14 18h20v2H14zm0 4h20v2H14zm0 4h20v2H14zm0 4h14v2H14z"/></svg>' },
            none: { title: cmDefaultTitle, icon: cmDefaultIcon }
        };
        
        function initConfig() {
            const savedCfg = localStorage.getItem('cmProxyConfig');
            if (savedCfg) {
                try {
                    Object.assign(appConfig, JSON.parse(savedCfg));
                } catch(e) { console.warn('Config parse error'); }
            }
            applyConfigToUI();
            applyConfigEffects();
        }
        
        function applyConfigToUI() {
            document.getElementById('cfgMuteNotifs').checked = appConfig.muteNotifs;
            document.getElementById('cfgAutoHideNav').checked = appConfig.autoHideNav;
            document.getElementById('cfgHideStatus').checked = appConfig.hideStatus;
            document.getElementById('cfgBlobMode').checked = appConfig.blobMode;
            document.getElementById('cfgDisguiseMode').value = appConfig.disguiseMode;
            document.getElementById('cfgPanicUrl').value = appConfig.panicUrl;
            document.getElementById('cfgPanicKey').value = appConfig.panicKey;
        }
        
        function persistConfig() {
            appConfig.muteNotifs = document.getElementById('cfgMuteNotifs').checked;
            appConfig.autoHideNav = document.getElementById('cfgAutoHideNav').checked;
            appConfig.hideStatus = document.getElementById('cfgHideStatus').checked;
            appConfig.blobMode = document.getElementById('cfgBlobMode').checked;
            appConfig.disguiseMode = document.getElementById('cfgDisguiseMode').value;
            appConfig.panicUrl = document.getElementById('cfgPanicUrl').value || 'https://classroom.google.com';
            appConfig.panicKey = document.getElementById('cfgPanicKey').value;
            localStorage.setItem('cmProxyConfig', JSON.stringify(appConfig));
            applyConfigEffects();
        }
        
        function applyConfigEffects() {
            const containerEl = document.getElementById('container');
            containerEl.classList.toggle('navAutoHide', appConfig.autoHideNav);
            containerEl.classList.toggle('statusHidden', appConfig.hideStatus);
            
            if (appConfig.disguiseMode !== 'none') {
                const preset = disguisePresets[appConfig.disguiseMode];
                document.title = preset.title;
                document.getElementById('favicon').href = preset.icon;
                isCloaked = true;
                tabCloakBtn.classList.add('active');
            }
        }
        
        function showConfigPanel() {
            document.getElementById('settingsOverlay').classList.add('visible');
        }
        
        function hideConfigPanel() {
            document.getElementById('settingsOverlay').classList.remove('visible');
        }
        
        function triggerPanicMode() {
            window.location.replace(appConfig.panicUrl);
        }
        
        document.addEventListener('keydown', function(evt) {
            if (evt.code === appConfig.panicKey) {
                triggerPanicMode();
            }
        });
        
        document.getElementById('settingsOverlay').addEventListener('click', function(evt) {
            if (evt.target === this) hideConfigPanel();
        });
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(function() {});
        }
        
        initConfig();
        
        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        
        function toggleTabCloak() {
            isCloaked = !isCloaked;
            
            if (isCloaked) {
                const selectedMode = appConfig.disguiseMode;
                const preset = disguisePresets[selectedMode] || disguisePresets.classroom;
                document.title = preset.title;
                document.getElementById('favicon').href = preset.icon;
                tabCloakBtn.classList.add('active');
                showToast('Tab disguised');
            } else {
                document.title = cmDefaultTitle;
                document.getElementById('favicon').href = cmDefaultIcon;
                tabCloakBtn.classList.remove('active');
                showToast('Disguise removed');
            }
        }
        
        function showToast(message) {
            if (appConfig.muteNotifs) return;
            toast.textContent = message;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 2000);
        }
        
        function updateCombinedStatus(mainText, detailText) {
            if (detailText) {
                status.textContent = mainText + ' • ' + detailText;
            } else {
                status.textContent = mainText;
            }
        }
        
        function createShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';
            
            const shadowHost = document.createElement('div');
            shadowHost.style.width = '100%';
            shadowHost.style.height = '100%';
            frameContainer.appendChild(shadowHost);
            
            shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
            
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.margin = '0';
            iframe.style.padding = '0';
            iframe.style.display = 'block';
            
            const sandboxAttr = isGame ? SANDBOX_GAME : SANDBOX_HOME;
            iframe.setAttribute('sandbox', sandboxAttr);
            iframe.setAttribute('allow', ALLOW_PERMISSIONS);
            iframe.setAttribute('title', isGame ? 'Game Preview' : 'CloudMoon Preview');
            iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
            
            iframe.src = url;
            
            shadowRoot.appendChild(iframe);
            currentIframe = iframe;
            
            iframe.addEventListener('load', () => {
                if (isGame) {
                    updateCombinedStatus('CloudMoon', 'Game/App Active');
                    console.log('%c Game loaded with full permissions', 'color: #10b981; font-weight: bold;');
                } else {
                    updateCombinedStatus('CloudMoon', 'Ready');
                }
                focusIframe();
            });
            
            iframe.addEventListener('error', (e) => {
                console.error('Iframe error:', e);
                status.textContent = 'Error loading - check console, reload, or try again Later';
            });
            
            console.log('%c Shadow DOM Created', 'color: #10b981; font-weight: bold;');
            console.log('Sandbox:', sandboxAttr);
            console.log('Allow:', ALLOW_PERMISSIONS);
        }
        
        function focusIframe() {
            setTimeout(() => {
                if (currentIframe) {
                    currentIframe.focus();
                    try {
                        currentIframe.contentWindow.focus();
                    } catch (e) {
                        // Cross-origin, expected
                    }
                }
            }, 100);
        }
        
        createShadowFrame(mainURL, false);
        
        document.addEventListener('click', (e) => {
            if (currentIframe && e.target !== currentIframe) {
                focusIframe();
            }
        });
        
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') {
                const gameUrl = event.data.url;
                console.log('Game URL received:', gameUrl);
                loadGame(gameUrl);
            }
        });
        
        function loadGame(url) {
            showToast('Loading Game...');
            
            updateCombinedStatus('CloudMoon', 'Loading Game...');
            console.log('Original URL:', url);
            
            let fixedURL = url;
            const workerDomain = window.location.origin;
            
            if (url.includes(workerDomain)) {
                fixedURL = url.replace(workerDomain, 'https://web.cloudmoonapp.com');
            }
            
            if (appConfig.blobMode) {
                fetch(fixedURL).then(r => r.blob()).then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    createShadowFrame(blobUrl, true);
                }).catch(() => createShadowFrame(fixedURL, true));
            } else {
                createShadowFrame(fixedURL, true);
            }
            
            console.log('%c Loading game with FULL sandbox permissions', 'color: #667eea; font-weight: bold;');
            console.log('Game URL:', fixedURL);
            
            isShowingGame = true;
            backBtn.style.display = 'flex';
        }
        
        function goBack() {
            createShadowFrame(mainURL, false);
            isShowingGame = false;
            backBtn.style.display = 'none';
            updateCombinedStatus('CloudMoon', 'Loading...');
        }
        
        function reloadFrame() {
            const iframe = shadowRoot.querySelector('iframe');
            if (iframe) {
                const currentUrl = iframe.src;
                iframe.src = 'about:blank';
                setTimeout(() => {
                    iframe.src = currentUrl;
                }, 50);
            }
        }
        
        function toggleFullscreen() {
            const navBar = document.getElementById('header');
            
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                navBar.style.setProperty('display', 'none', 'important');
            } else {
                document.exitFullscreen();
                navBar.style.setProperty('display', 'flex', 'important');
            }
        }
        
        document.addEventListener('fullscreenchange', function() {
            const navBar = document.getElementById('header');
            if (!document.fullscreenElement) {
                navBar.style.removeProperty('display');
                navBar.style.display = 'flex';
            }
        });
        
        function openAboutBlank() {
            const aboutBlankWindow = window.open('about:blank', '_blank');
            const shadowHost = aboutBlankWindow.document.createElement('div');
            aboutBlankWindow.document.body.appendChild(shadowHost);
            
            const shadow = shadowHost.attachShadow({ mode: 'closed' });
            
            const iframe = aboutBlankWindow.document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.margin = '0';
            iframe.style.padding = '0';
            
            iframe.setAttribute('sandbox', SANDBOX_GAME);
            iframe.setAttribute('allow', ALLOW_PERMISSIONS);
            iframe.src = window.location.href;
            
            shadow.appendChild(iframe);
            
            aboutBlankWindow.document.body.style.margin = '0';
            aboutBlankWindow.document.body.style.padding = '0';
            aboutBlankWindow.document.body.style.overflow = 'hidden';
        }
        
        console.log('%c CloudMoon Proxy Active', 'color: #667eea; font-size: 18px; font-weight: bold;');
        console.log('%c GoGuardian Bypass: CodeSandbox Method', 'color: #10b981; font-size: 14px; font-weight: bold;');
        console.log('%c Shadow DOM + Smart Sandbox + Full Permissions', 'color: #10b981; font-size: 12px;');
    </script>
</body>
</html>`;
}

function getPWAManifest() {
  const manifestData = {
    name: 'CloudMoon InPlay',
    short_name: 'CloudMoon',
    description: 'Play games in browser with CloudMoon',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1117',
    theme_color: '#2d2d2d',
    icons: [
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">☁️</text></svg>',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  };
  return JSON.stringify(manifestData, null, 2);
}
