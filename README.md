# CloudMoon InPlay

Cloudmoon InPlay is a simple site that proxies, hides, and loads cloudmoon in a browser using Cloudflare workers, allowing you to effortlessly play Roblox, Fortnight, Call of Duty Mobile, Delta Force, and More in Browser at school or work!

> [!NOTE]
> If you fork or use this repository, Please consider sharing or giving us a Star!

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sriail/Cloudmoon-InPlay)

## How It Works - Two-Phase System

CloudMoon InPlay uses a **two-phase system** to allow both Google Sign-In AND game playing:

### Phase 1: Direct Mode (Sign In)
When you first open the site, it loads CloudMoon **directly** (not through the proxy). This allows Google Sign-In to work normally because the browser connects directly to `web.cloudmoonapp.com`.

### Phase 2: Proxy Mode (Play Games)
After signing in, click the **"Enable Proxy"** button to switch to proxy mode. This routes all traffic through the Cloudflare Worker, which:
- Bypasses network restrictions
- Injects game interception code so games open in the same window
- Keeps you logged in (session persists)

## Use

1. **Sign in first**: Use Google Sign-In while in Direct Mode (green "Enable Proxy" button)
2. **Enable Proxy**: Click the "Enable Proxy" button to switch to Proxy Mode (purple "Proxy Mode" button)
3. **Play games**: Browse and click on games - they will open in the same window
4. **Use the Back button**: Return to the game library after playing

> [!TIP]
> The status bar shows which mode you're in:
> - "Direct Mode - sign in works!" = Use Google Sign-In here
> - "Proxy Mode - games work!" = Play games here

> [!NOTE]
> When Cloudmoon tries to open a new Tab, it will open in the central iframe to avoid being blocked.

## Deploy

To deploy your owen cloudmoon worker, click the deploy to cloudflare button, for maxamum security, it is recomended that it is embeded into another site using this code (blocks extentions with restrictive content policies). Be shure to chage 
``` src="Worker" ``` With your Worker (example URl : milefalencentfog47a.johndoe.workers.dev )

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Cloudmoon InPlay</title>
    <style>
      /* Ensure the container takes up the full viewport */
      html,
      body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      full-page-frame {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <!-- Custom element that will hold the triple Shadow DOM -->
    <full-page-frame
      src="Worker"  <!-- Replace with your own proxy / Cloudflare Worker -->
    ></full-page-frame>
    <script>
      class FullPageFrame extends HTMLElement {
        connectedCallback() {
          // Layer 1: First Shadow DOM
          const shadow1 = this.attachShadow({ mode: "closed" });
          
          // Create first layer container
          const layer1Container = document.createElement("div");
          layer1Container.setAttribute("id", "layer1");
          
          const style1 = document.createElement("style");
          style1.textContent = `
            #layer1 {
              width: 100%;
              height: 100%;
              display: block;
            }
          `;
          
          shadow1.appendChild(style1);
          shadow1.appendChild(layer1Container);
          
          // Layer 2: Second Shadow DOM (nested)
          const shadow2 = layer1Container.attachShadow({ mode: "closed" });
          
          const layer2Container = document.createElement("div");
          layer2Container.setAttribute("id", "layer2");
          
          const style2 = document.createElement("style");
          style2.textContent = `
            #layer2 {
              width: 100%;
              height: 100%;
              display: block;
            }
          `;
          
          shadow2.appendChild(style2);
          shadow2.appendChild(layer2Container);
          
          // Layer 3: Third Shadow DOM (nested)
          const shadow3 = layer2Container.attachShadow({ mode: "closed" });
          
          const layer3Container = document.createElement("div");
          layer3Container.setAttribute("id", "layer3");
          
          const style3 = document.createElement("style");
          style3.textContent = `
            #layer3 {
              width: 100%;
              height: 100%;
              display: block;
            }
            iframe {
              width: 100%;
              height: 100%;
              border: none;
              display: block;
            }
          `;
          
          shadow3.appendChild(style3);
          shadow3.appendChild(layer3Container);
          
          // Final iframe in the innermost layer
          const iframe = document.createElement("iframe");
          iframe.src = this.getAttribute("src");
          
          // Additional security attributes
          iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
          iframe.setAttribute("referrerpolicy", "no-referrer");
          
          layer3Container.appendChild(iframe);
          
          // Optional: Add random attributes to obfuscate structure
          this.setAttribute("data-component", this.generateRandomId());
          layer1Container.setAttribute("data-layer", this.generateRandomId());
          layer2Container.setAttribute("data-layer", this.generateRandomId());
          layer3Container.setAttribute("data-layer", this.generateRandomId());
        }
        
        generateRandomId() {
          return Math.random().toString(36).substring(2, 15);
        }
      }
      
      // Register the custom element
      customElements.define("full-page-frame", FullPageFrame);
    </script>
  </body>
</html>
```

