# Uganda MoH PMS — Progressive Web App (PWA)

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

## 🌐 Environment Configuration

Configuration variables are stored in `pwa/.env`:

```env
VITE_API_BASE_URL=http://45.10.154.35:8081/api/v1
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAI35I8y4m9bmqr-E2eRo-e8TnR025GLKg
```

> **Note on Production HTTPS**: When deploying to production, ensure the API endpoint is served over HTTPS to avoid browser Mixed Content blocks, as Service Workers and Geolocation strictly require a secure origin (`https://`).

