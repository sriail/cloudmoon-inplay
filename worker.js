// Cloudflare Worker - CloudMoon Proxy with Tab Cloaking and Google Sign-In Support
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  // Google domains that need to be proxied for sign-in
  const GOOGLE_AUTH_DOMAINS = [
    'accounts.google.com',
    'oauth2.googleapis.com',
    'www.googleapis.com',
    'apis.google.com',
    'ssl.gstatic.com',
    'www.gstatic.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'lh3.googleusercontent.com',
    'googleusercontent.com'
  ];
  
  async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Serve the main HTML page
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getMainHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Handle Google auth proxy routes
    if (url.pathname.startsWith('/gauth/')) {
      return proxyGoogleAuth(request);
    }
    
    // Proxy everything else to CloudMoon
    return proxyCloudMoon(request);
  }
  
  // Proxy Google authentication requests
  async function proxyGoogleAuth(request) {
    const url = new URL(request.url);
    const workerOrigin = url.origin;
    
    // Extract the target Google URL from the path
    // Format: /gauth/domain.com/path
    const pathParts = url.pathname.replace('/gauth/', '').split('/');
    const targetDomain = pathParts[0];
    const targetPath = '/' + pathParts.slice(1).join('/') + url.search;
    const targetURL = 'https://' + targetDomain + targetPath;
    
    console.log('Proxying Google Auth:', targetURL);
    
    const headers = new Headers(request.headers);
    headers.set('Host', targetDomain);
    headers.set('Origin', 'https://' + targetDomain);
    headers.set('Referer', 'https://' + targetDomain + '/');
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
      redirect: 'manual'
    });
    
    let response = await fetch(proxyRequest);
    
    // Handle redirects by rewriting them to go through our proxy
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        const newLocation = rewriteGoogleUrl(location, workerOrigin);
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Location', newLocation);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }
    }
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', '*');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Frame-Options');
    newHeaders.delete('Cross-Origin-Opener-Policy');
    newHeaders.delete('Cross-Origin-Embedder-Policy');
    
    const contentType = response.headers.get('Content-Type') || '';
    
    // Rewrite HTML/JS content to redirect Google URLs through our proxy
    if (contentType.includes('text/html') || contentType.includes('javascript')) {
      let content = await response.text();
      content = rewriteGoogleContent(content, workerOrigin);
      
      return new Response(content, {
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
  
  // Rewrite a single Google URL to go through our proxy
  function rewriteGoogleUrl(url, workerOrigin) {
    try {
      const parsed = new URL(url);
      for (const domain of GOOGLE_AUTH_DOMAINS) {
        // Check for exact match OR proper subdomain (preceded by a dot)
        if (parsed.hostname === domain || 
            (parsed.hostname.endsWith('.' + domain) && parsed.hostname.length > domain.length + 1)) {
          return workerOrigin + '/gauth/' + parsed.hostname + parsed.pathname + parsed.search;
        }
      }
    } catch (e) {
      // URL parsing failed, return as-is
    }
    return url;
  }
  
  // Pre-compiled regex patterns for URL rewriting
  const GOOGLE_URL_PATTERNS = GOOGLE_AUTH_DOMAINS.map(domain => ({
    domain,
    https: new RegExp('https://' + domain.replace(/\./g, '\\.'), 'g'),
    protocolRelative: new RegExp('(["\'])//(' + domain.replace(/\./g, '\\.') + ')', 'g')
  }));

  // Rewrite content to redirect Google URLs through proxy
  function rewriteGoogleContent(content, workerOrigin) {
    // Replace Google auth domain URLs with proxied versions using pre-compiled patterns
    for (const pattern of GOOGLE_URL_PATTERNS) {
      // Replace https://domain URLs
      content = content.replace(pattern.https, workerOrigin + '/gauth/' + pattern.domain);
      
      // Replace //domain URLs (protocol-relative) with any quote type
      content = content.replace(pattern.protocolRelative, '$1' + workerOrigin + '/gauth/' + pattern.domain);
    }
    return content;
  }
  
  async function proxyCloudMoon(request) {
    const url = new URL(request.url);
    const workerOrigin = url.origin;
    
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
    newHeaders.delete('Cross-Origin-Opener-Policy');
    newHeaders.delete('Cross-Origin-Embedder-Policy');
    
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // Rewrite Google URLs to go through our proxy
      html = rewriteGoogleContent(html, workerOrigin);
      
      const injectionScript = `
        <script>
          (function() {
            console.log('CloudMoon Interceptor Injected');
            
            // Store the worker origin for URL rewriting
            const WORKER_ORIGIN = '${workerOrigin}';
            const GOOGLE_DOMAINS = [
              'accounts.google.com',
              'oauth2.googleapis.com',
              'www.googleapis.com',
              'apis.google.com',
              'ssl.gstatic.com',
              'www.gstatic.com'
            ];
            
            // Helper function to check if hostname matches a Google domain (exact or subdomain)
            function isGoogleDomain(hostname, domain) {
              return hostname === domain || 
                     (hostname.endsWith('.' + domain) && hostname.length > domain.length + 1);
            }
            
            // Helper function to rewrite Google URLs
            function rewriteGoogleUrl(url) {
              if (!url) return url;
              try {
                const parsed = new URL(url, window.location.href);
                for (const domain of GOOGLE_DOMAINS) {
                  if (isGoogleDomain(parsed.hostname, domain)) {
                    return WORKER_ORIGIN + '/gauth/' + parsed.hostname + parsed.pathname + parsed.search;
                  }
                }
              } catch (e) {}
              return url;
            }
            
            // Intercept window.open for games AND Google auth
            const originalOpen = window.open;
            window.open = function(url, target, features) {
              console.log('Intercepted window.open:', url);
              
              // Handle game URLs
              if (url && url.includes('run-site')) {
                console.log('Game URL detected!');
                
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    type: 'LOAD_GAME',
                    url: url
                  }, '*');
                } else {
                  window.location.href = url;
                }
                
                return {
                  closed: false,
                  close: () => {},
                  focus: () => {}
                };
              }
              
              // Handle Google auth URLs - redirect through proxy
              if (url) {
                const rewrittenUrl = rewriteGoogleUrl(url);
                if (rewrittenUrl !== url) {
                  console.log('Google auth URL rewritten:', rewrittenUrl);
                  return originalOpen.call(this, rewrittenUrl, target, features);
                }
              }
              
              return originalOpen.call(this, url, target, features);
            };
            
            // Intercept fetch requests to Google
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = typeof input === 'string' ? input : input.url;
              const rewrittenUrl = rewriteGoogleUrl(url);
              if (rewrittenUrl !== url) {
                console.log('Fetch intercepted, rewriting:', url, '->', rewrittenUrl);
                if (typeof input === 'string') {
                  return originalFetch.call(this, rewrittenUrl, init);
                } else {
                  // When input is a Request, pass init options separately
                  return originalFetch.call(this, rewrittenUrl, init);
                }
              }
              return originalFetch.call(this, input, init);
            };
            
            // Intercept XMLHttpRequest
            const originalXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              const rewrittenUrl = rewriteGoogleUrl(url);
              if (rewrittenUrl !== url) {
                console.log('XHR intercepted, rewriting:', url, '->', rewrittenUrl);
                return originalXHROpen.call(this, method, rewrittenUrl, async, user, password);
              }
              return originalXHROpen.call(this, method, url, async, user, password);
            };
            
            // Intercept script loading for Google Identity Services
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
              const element = originalCreateElement.call(this, tagName);
              if (tagName.toLowerCase() === 'script') {
                const originalSetAttribute = element.setAttribute.bind(element);
                element.setAttribute = function(name, value) {
                  if (name === 'src') {
                    const rewrittenUrl = rewriteGoogleUrl(value);
                    if (rewrittenUrl !== value) {
                      console.log('Script src rewritten:', value, '->', rewrittenUrl);
                      return originalSetAttribute(name, rewrittenUrl);
                    }
                  }
                  return originalSetAttribute(name, value);
                };
                
                // Also intercept direct src assignment
                Object.defineProperty(element, 'src', {
                  get: function() {
                    return element.getAttribute('src');
                  },
                  set: function(value) {
                    const rewrittenUrl = rewriteGoogleUrl(value);
                    if (rewrittenUrl !== value) {
                      console.log('Script src property rewritten:', value, '->', rewrittenUrl);
                      element.setAttribute('src', rewrittenUrl);
                    } else {
                      element.setAttribute('src', value);
                    }
                  }
                });
              }
              if (tagName.toLowerCase() === 'iframe') {
                const originalSetAttribute = element.setAttribute.bind(element);
                element.setAttribute = function(name, value) {
                  if (name === 'src') {
                    const rewrittenUrl = rewriteGoogleUrl(value);
                    if (rewrittenUrl !== value) {
                      console.log('Iframe src rewritten:', value, '->', rewrittenUrl);
                      return originalSetAttribute(name, rewrittenUrl);
                    }
                  }
                  return originalSetAttribute(name, value);
                };
                
                Object.defineProperty(element, 'src', {
                  get: function() {
                    return element.getAttribute('src');
                  },
                  set: function(value) {
                    const rewrittenUrl = rewriteGoogleUrl(value);
                    if (rewrittenUrl !== value) {
                      console.log('Iframe src property rewritten:', value, '->', rewrittenUrl);
                      element.setAttribute('src', rewrittenUrl);
                    } else {
                      element.setAttribute('src', value);
                    }
                  }
                });
              }
              return element;
            };
            
            console.log('CloudMoon Google Sign-In Proxy Active');
            
          })();
        </script>
      `;
      
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
    
    // Also rewrite JS files that might contain Google URLs
    if (contentType.includes('javascript')) {
      let js = await response.text();
      js = rewriteGoogleContent(js, workerOrigin);
      
      return new Response(js, {
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
          </div>
          <div id="frame-container"></div>
      </div>
      
      <div id="toast">
          Loading your Game / App...
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
          
          // Original title and favicon
          const originalTitle = 'CloudMoon InPlay';
          const originalFavicon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☁️</text></svg>";
          
          // Google Classroom cloak
          const cloakedTitle = 'Classes';
          const cloakedFavicon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAADW0lEQVRYhb2XT0hUURTGf+fNm+bVNP4ZxRhKAxeVBLYoaBOEEkTQpk0EbVpEELRo1aKgRYQtItrUKqJ/i6BVRBCUQYsWYf9QMwoz0cxCZ3TmzX1vbgtnHI3RmXl64MPLvY9zv3vOveee71F+RMvuQ/d2CIwClh48WN/98U0+TwVA6e17dwM3gb1Axt8FjgEnwnqmNo9n/xdA6Z1HTUAncAzY5gMAnAL6gMOSqRsA7PkuTu+9d3eBl8BeYOs6q54CuoCj3hON5yXbsI6HL4BbwGHW//gAXcBR741G5QdwyJDyYpAgmNz0VztTqD87Zt7+vBiMbKC0vPZc4XmJf8d0z0pP/tPYr4s3PgwvADcAbxOxXoCqc9c3FZ9dHAcmCtWuO97w8q3+H6N/D3WlXqSmawl6OoFzQAl/SVXHh9oj/UOnL4HSpF6JPBGAW8Bp4B5wsEi+sxnoTRpgKzBayHj92r0twFRBv+cBFHi4kZPtCthRACtJAQSwOQGAwvV8IMkABjBlLQFYOgmAEdsaQBpbBEsCUDlgpwFMJ+RYAL6XAnCiWMFCfhqoAFbfibDzAIMvB4ZfFwigb8EGLnjPNw54zzU2A0PeC00HclXCRd+QUur3Pdu/tqkXwLNc7TQ1bU8AXT//qbDgfk9K5fKqp+E7sL+qqvofVYAL7nWnMTqC68D9X1Wkp+EHcGD1fSXi+/U0HAQe+SXIC59cZAA+/noBYlTPtdYnADDvvdCcD4C+S/feAH1/2P8ZePSrHf4OQHe+AJxwO9sTcFt+L5ALINfXuqTUMeBbvu6bC2AOOJHv8/vWE61jgj0J/AWvJz4Am8D5YgAorxjXfkD6/2M6rwnvhaZ2XdmGd+4HgZ68pJ/sePluEBjxnm9auw82HUCpu/eUUk/x++K/dsSGx/3fDrjgTM8SrWZA+f05rydaFwAclVx9T96K6PW0PZBE9fy67uN8vhHlx5t8Zyh83vwL5V+RTBF9wWy4AAC+t1rPAyfxu9S/WgC4o5R6opXeBNz0u9l15Xvjhc/yBYgAAMGU7/dRG1Dpr/8B+BLoO9yzYzp4f7MnXxPOC0Cp1s5ub5bQHlyAemCHP14KfAD6J/SJ5uDtpc+FeP8E0sLYXdZbKF8AAAAASUVORK5CYII=';
          
          const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock';
          const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
          const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad; web-share';
          
          function toggleTabCloak() {
              isCloaked = !isCloaked;
              
              if (isCloaked) {
                  // Enable cloak - Google Classroom
                  document.title = cloakedTitle;
                  document.getElementById('favicon').href = cloakedFavicon;
                  tabCloakBtn.classList.add('active');
                  showToast('Tab cloaked as Google Classroom');
              } else {
                  // Disable cloak - restore original
                  document.title = originalTitle;
                  document.getElementById('favicon').href = originalFavicon;
                  tabCloakBtn.classList.remove('active');
                  showToast('Tab cloak disabled');
              }
          }
          
          function showToast(message) {
              toast.textContent = message;
              toast.style.display = 'block';
              setTimeout(() => {
                  toast.style.display = 'none';
              }, 2000);
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
                      status.textContent = 'Game / App running';
                      console.log('%c Game loaded with full permissions', 'color: #10b981; font-weight: bold;');
                  } else {
                      status.textContent = 'CloudMoon loaded';
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
              showToast('Loading your Game / App...');
              
              status.textContent = 'Loading your Game / App...';
              console.log('Original URL:', url);
              
              let fixedURL = url;
              const workerDomain = window.location.origin;
              
              if (url.includes(workerDomain)) {
                  fixedURL = url.replace(workerDomain, 'https://web.cloudmoonapp.com');
              }
              
              console.log('%c Loading game with FULL sandbox permissions', 'color: #667eea; font-weight: bold;');
              console.log('Game URL:', fixedURL);
              
              createShadowFrame(fixedURL, true);
              
              isShowingGame = true;
              backBtn.style.display = 'flex';
          }
          
          function goBack() {
              createShadowFrame(mainURL, false);
              isShowingGame = false;
              backBtn.style.display = 'none';
              status.textContent = 'Loading CloudMoon...';
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
              const header = document.getElementById('header');
              
              if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                  header.style.display = 'none';
              } else {
                  document.exitFullscreen();
                  header.style.display = 'flex';
              }
          }
          
          document.addEventListener('fullscreenchange', () => {
              const header = document.getElementById('header');
              if (!document.fullscreenElement) {
                  header.style.display = 'flex';
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
