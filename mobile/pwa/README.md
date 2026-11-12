# Uganda PMS iHRIS — Progressive Web App (PWA)

This Progressive Web Application (PWA) is the field client for the **Uganda Ministry of Health Performance Management System (PMS)**. It provides full offline-first mobile and desktop support with duty attendance GPS geofencing, leave tracking, out-of-station travel duty assignments, supervisory approvals, and electronic signatures.

---

## 🚀 Key Features

1. **Duty Attendance & GPS Geofencing**:
   - High-accuracy GPS capture via browser `navigator.geolocation`.
   - Real-time interactive Leaflet map with Kampala coordinates, user location marker, and 500m geofence circle.
   - Proximity HUD Banner showing distance in meters and warning if outside the geofence perimeter.
   - Duty remarks field validated with Zod schemas.
   - Offline-queued clock-in/out mutations via `useSyncStore`.

2. **Leave Management**:
   - Leave balances overview (Annual, Sick, Study, Maternity, etc.).
   - Leave application form with category selector, HTML5 date-range picker, and reason validation.
   - Attachment picker supporting PDF documents and images with Base64 conversion.
   - Request history timeline with status badges (Approved, Pending Review, Rejected).

3. **Out of Station (OOS) Travel Duties**:
   - Travel duty application with Google Places autocomplete search, date ranges, deliverables, and remarks.
   - 500m geofence visualization around destination facility.
   - Dedicated travel attendance duty clock-in/out with proximity locking.

4. **Supervisory Approvals**:
   - Unified inbox for team leave applications and travel clearances.
   - Multi-stage approval/rejection modal with supervisor comments.

5. **Officer Profile & Electronic Signature**:
   - Staff biodata, cadre, IPPS number, facility deployment, and salary grade.
   - Profile photo upload with instant client preview.
   - HTML5 canvas signature pad (`signature_pad`) with touch/stylus support, exporting official PNG endorsements.

6. **Offline-First & PWA Architecture**:
   - Full Service Worker precaching generated via `vite-plugin-pwa` and Workbox.
   - Offline mutation queue stored persistently in IndexedDB (`idbStorage`).
   - Automated queue drain upon internet reconnection via browser `online` listener.
   - Add to Home Screen install banner for Android Chrome and iOS Safari.
   - Dark, Light, and System Default theme support.

---

## 🛠️ Development & Build Commands

```bash
# Navigate to the PWA workspace
cd mobile/pwa

# Install dependencies (if not already installed)
npm install

# Start local development server with hot-reload (http://localhost:3000)
npm run dev

# Compile TypeScript and build production bundle with Service Worker
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Environment Configuration & Security

All environment configuration is managed via environment files (`.env`). Real backend URLs, server hosts, and API keys are strictly git-ignored via `.gitignore` (`.env`, `.env.*`) to prevent credentials or internal IPs from being exposed in version control.

A template configuration is provided in `pwa/.env.example`:

```bash
# 1. Copy the template to your local untracked environment file
cp .env.example .env
```

### Supported Environment Variables
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Frontend API base path. Keep `/api/v1` (relative) for reverse proxy setups. Set full URL only for direct API. | `/api/v1` |
| `BACKEND_API_SERVER` | Remote/target backend server URL for Nginx reverse proxy. | `http://localhost:8081` |
| `BACKEND_API_HOST` | Host header forwarded to target backend server. | `localhost:8081` |
| `VITE_BACKEND_API_SERVER` | Target backend server for Vite dev server proxy. | `http://localhost:8081` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Places / Maps API key for facility searches. | *(your key)* |

> **Security Note**: Never commit `.env` or `.env.production` to git. All `.env*` files (except `.env.example`) are ignored in `.gitignore`.

---

## 🚀 Deployment Options (Local & Production)

### 1. Local Development & Deployment

#### Option 1A: Vite Dev Server with Built-in Proxy (Fastest for Development)
In local development, the frontend runs on port 3000 and Vite proxies `/api` calls directly to your backend server without needing Docker:
```bash
# 1. Set backend server in .env
VITE_BACKEND_API_SERVER=http://your-backend-ip:8081
VITE_API_BASE_URL=/api/v1

# 2. Run dev server
npm run dev
# App available at http://localhost:3000
```

#### Option 1B: Local Docker Compose (Simulates Production Nginx Gateway)
Run the full production-like containerized setup locally:
```bash
# 1. Configure target backend in .env
BACKEND_API_SERVER=http://your-backend-ip:8081
BACKEND_API_HOST=your-backend-ip:8081

# 2. Build and launch container
docker compose up -d --build
# App available at http://localhost:8080
```

---

### 2. Production Deployment

When deploying the PWA to production (and when the backend API base URL changes), choose one of the two options below:

---

#### Option 1 (Recommended): Production Reverse Proxy with Docker & Nginx
*Best for: Zero CORS issues, avoiding Mixed Content SSL blocks, and seamless backend URL changes without rebuilding frontend JavaScript bundles.*

In this architecture, the PWA client code consistently sends requests to same-origin relative endpoints (`/api/v1/...`). Nginx terminates SSL and reverse-proxies `/api/` traffic to the backend server. The backend IP or domain is **injected at container startup via environment variables**.

**How to deploy / change the backend URL in production:**

1. Define the backend target in your production environment (e.g. in your production `.env` or CI/CD environment):
   ```env
   BACKEND_API_SERVER=https://api.pms.health.go.ug
   BACKEND_API_HOST=api.pms.health.go.ug
   ```

2. Run with Docker Compose:
   ```bash
   # Launch production container
   docker compose up -d --build
   ```
   *Note: Nginx automatically reads `BACKEND_API_SERVER` and `BACKEND_API_HOST` via `/etc/nginx/templates/nginx.conf.template` on container start.*

3. If running Nginx directly on a Linux host (without Docker):
   Update the `proxy_pass` and `proxy_set_header Host` directives in your host Nginx configuration:
   ```nginx
   location /api/ {
       proxy_pass https://api.pms.health.go.ug/api/;
       proxy_set_header Host api.pms.health.go.ug;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
   Then reload: `sudo nginx -s reload`.

**Advantages**:
- When the backend IP/domain changes, **zero rebuilds of the PWA are required**.
- No CORS preflight latency.
- Internal backend IPs remain completely hidden from public inspection.

---

#### Option 2: Direct Cross-Origin API Deployment (Static Web Host / CDN)
*Best for: Hosting frontend on static web hosting providers (AWS S3 + CloudFront, Cloudflare Pages, Netlify, Vercel) where no Nginx reverse proxy is used.*

In this architecture, the PWA client in the user's browser communicates directly with the remote backend API.

**How to deploy / change the backend URL in production:**

1. Set the new API URL in your build environment (`.env.production` or CI/CD pipeline variables):
   ```env
   VITE_API_BASE_URL=https://api.pms.health.go.ug/api/v1
   ```

2. Compile the production bundle:
   ```bash
   npm run build
   ```
   *(Because Vite embeds `VITE_API_BASE_URL` into static JS bundles at build time, a rebuild is required whenever the URL changes.)*

3. Deploy the resulting `pwa/dist/` directory to your static hosting provider or CDN bucket.

4. **Required Backend CORS Setup**:
   The remote API server MUST enable CORS headers allowing your PWA origin:
   ```http
   Access-Control-Allow-Origin: https://pms.health.go.ug
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
   ```

---

## 📱 PWA Device Installation Prompting

The application features an automated, non-intrusive install prompt (`GlobalPwaInstallPrompt`) mounted globally in `src/App.tsx`:

1. **Already Installed Check**:
   If the app is already installed (`window.matchMedia('(display-mode: standalone)').matches`, iOS `navigator.standalone`, or Android TWA), the prompt is suppressed automatically.

2. **Android & Desktop Chromium**:
   Captures the browser's `beforeinstallprompt` event and shows a floating install card on initial app open. Tapping **"Install App"** calls the native browser install dialog.

3. **iOS Safari (iPhone / iPad)**:
   Apple Safari does not support the `beforeinstallprompt` event. The app detects iOS Safari in browser mode and displays a visual step-by-step guide explaining how to tap **Share** ➔ **"Add to Home Screen"** ➔ **"Add"**.

4. **Dismissal & Cooldown**:
   Dismissing the prompt stores a timestamp in `localStorage`. The prompt will not reappear for 24 hours to prevent user fatigue.

