// Cloudflare Worker - CloudMoon Proxy with Fixed URL Handling
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
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
    // Direct proxy path
    const encodedURL = url.pathname.replace('/proxy/', '');
    targetURL = decodeURIComponent(encodedURL);
  } else {
    // Relative path - proxy to CloudMoon
    targetURL = 'https://web.cloudmoonapp.com' + url.pathname + url.search;
  }
  
  console.log('Proxying:', targetURL);
  
  // Create headers, removing problematic ones
  const headers = new Headers(request.headers);
  headers.set('Host', new URL(targetURL).host);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');
  
  // Make the request
  const proxyRequest = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'follow'
  });
  
  let response = await fetch(proxyRequest);
  
  // Create new response with modified headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('X-Frame-Options');
  
  const contentType = response.headers.get('Content-Type') || '';
  
  // Only modify HTML responses
  if (contentType.includes('text/html')) {
    let html = await response.text();
    
    // Inject interception script
    const injectionScript = `
      <script>
        (function() {
          console.log('🎮 CloudMoon Interceptor Injected');
          
          // Override window.open
          const originalOpen = window.open;
          window.open = function(url, target, features) {
            console.log('🔍 Intercepted window.open:', url);
            
            // Intercept game URLs
            if (url && url.includes('run-site')) {
              console.log('🎮 Game URL detected!');
              
              // Tell parent to load the game
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'LOAD_GAME',
                  url: url
                }, '*');
              } else {
                // Load in current window
                window.location.href = url;
              }
              
              return {
                closed: false,
                close: () => {},
                focus: () => {}
              };
            }
            
            // Allow other popups (Google auth, etc)
            return originalOpen.call(this, url, target, features);
          };
          
        })();
      </script>
    `;
    
    // Inject the script
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + injectionScript);
    } else {
      html = injectionScript + html;
    }
    
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  // For non-HTML, just return with CORS headers
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
    <title>CloudMoon Proxy</title>
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
        
        .icon {
            width: 16px;
            height: 16px;
        }
        
        iframe {
            flex: 1;
            width: 100%;
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
    </style>
</head>
<body>
    <div id="container">
        <div id="header">
            <div id="title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/>
                </svg>
                CloudMoon Proxy
            </div>
            <div id="status">Loading CloudMoon...</div>
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
        </div>
        <iframe id="main-frame" src="/web.cloudmoonapp.com/"></iframe>
    </div>
    
    <div id="toast">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/>
        </svg>
        Game intercepted!
    </div>

    <script>
        const frame = document.getElementById('main-frame');
        const status = document.getElementById('status');
        const backBtn = document.getElementById('back-btn');
        const toast = document.getElementById('toast');
        
        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        
        frame.addEventListener('load', () => {
            if (!isShowingGame) {
                status.textContent = 'CloudMoon loaded';
            } else {
                status.textContent = 'Game running';
            }
            
            // Focus the iframe so it receives keyboard input
            setTimeout(() => {
                frame.focus();
                try {
                    frame.contentWindow.focus();
                } catch (e) {
                    // Cross-origin, can't access contentWindow
                }
            }, 100);
        });
        
        // Refocus iframe when clicking on the page
        document.addEventListener('click', (e) => {
            if (e.target !== frame) {
                frame.focus();
            }
        });
        
        // Listen for game URLs from iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') {
                const gameUrl = event.data.url;
                console.log('Game URL received:', gameUrl);
                loadGame(gameUrl);
            }
        });
        
        function loadGame(url) {
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 2000);
            
            status.textContent = 'Loading game...';
            console.log('Original intercepted URL:', url);
            
            // Replace worker domain with CloudMoon domain
            let fixedURL = url;
            const workerDomain = window.location.origin;
            
            if (url.includes(workerDomain)) {
                fixedURL = url.replace(workerDomain, 'https://web.cloudmoonapp.com');
            }
            
            console.log('Fixed game URL (direct, no proxy):', fixedURL);
            
            frame.src = fixedURL;
            isShowingGame = true;
            backBtn.style.display = 'flex';
        }
        
        function goBack() {
            frame.src = mainURL;
            isShowingGame = false;
            backBtn.style.display = 'none';
            status.textContent = 'Loading CloudMoon...';
        }
        
        function reloadFrame() {
            frame.src = frame.src;
        }
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
        
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
            iframe.src = window.location.href;
            
            shadow.appendChild(iframe);
            
            aboutBlankWindow.document.body.style.margin = '0';
            aboutBlankWindow.document.body.style.padding = '0';
            aboutBlankWindow.document.body.style.overflow = 'hidden';
        }
        
        console.log('%c CloudMoon Proxy Active', 'color: #667eea; font-size: 18px; font-weight: bold;');
    </script>
</body>
</html>`;
}

/*
DEPLOYMENT:
1. Go to Cloudflare Workers dashboard
2. Create new Worker
3. Paste this code
4. Deploy

This version:
✅ Proxies ALL requests to CloudMoon (JS, CSS, images, etc)
✅ Removes CSP and X-Frame-Options headers
✅ Adds CORS headers
✅ Injects interception script into HTML only
✅ Handles relative URLs correctly
✅ Auto-intercepts game popups
