# Q_Sync: Unified Virtual Queuing and Dynamic Scheduling Platform

## 📌 Project Overview
Q_Sync is a lightweight, "Scan-to-Book" virtual queuing and appointment system designed specifically for the unorganized local economy (salons, clinics, mechanics, government desks, canteens, etc.). 

It solves the problem of physical waiting lines by allowing customers to join a live digital queue via a QR code or link, without needing to download a dedicated mobile app. Vendors get a zero-friction, highly scalable dashboard to manage their queues dynamically.

## 🚀 Core Features

### 1. App-Less Customer Experience (PWA)
- Customers scan a high-res QR code at the vendor's physical location.
- Opens a Progressive Web App (PWA) directly in their browser.
- **Session Recovery:** Even if the browser tab is closed, the session is recovered via LocalStorage.
- **Live Photo Verification:** Prevents spam proxy-bookings by requiring a live camera capture to book a token.

### 2. The Smart Queue Engine (FIFO & Penalty Shift)
- Maintains a strict First-Come-First-Serve (FIFO) global queue.
- **Penalty Shift Algorithm:** If a customer is a no-show when called, the vendor clicks "Skip". The customer incurs a "strike" and is dynamically pushed back in the queue (e.g., 5 positions back). The next person is called immediately.
- Tokens are forcefully cancelled after maximum strikes are reached.

### 3. Dynamic Scheduling
- **Immediate vs Delayed:** Customers can join the live queue instantly, or schedule for later. 
- Scheduled customers are placed in a staging database and injected into the live queue automatically by a background cron-job at their scheduled time.
- **Self-Push-Back:** Customers running late can opt to push their own token backward by a vendor-configured limit.

### 4. Real-Time UI (WebSockets)
- Powered by Socket.io, the UI updates instantly without page reloads.
- Customers see live updates on their current position, Estimated Wait Time (ETA), and which token is currently being served.
- **Haptic/Audio Alerts:** Browser triggers native vibrations and chimes when the customer is 2 positions away.

### 5. Zero-Cost Infrastructure & Auditing
- **Free-tier Architecture:** Built entirely on open-source and free-tier cloud providers.
- **Static Geo-Pinning:** Captures exact GPS coordinates upon booking (no paid continuous tracking maps) and displays a static map iframe.
- **Digital Ledger:** Exact timestamps for Booking, Service Start, and Completion are recorded for end-of-day analytics.

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend:** React.js (via Vite), TailwindCSS v4
- **Backend:** Node.js, Express.js, Socket.io
- **Database:** PostgreSQL (hosted on Supabase)

### Deployment Strategy (Zero-Cost Production)
This architecture is specifically designed to be deployed across serverless and free-tier cloud platforms:
- **Frontend Hosting (Vercel / Netlify):** The Vite/React application is deployed here. Vercel provides lightning-fast global CDNs, automatic SSL, and continuous integration directly from GitHub.
- **Backend Hosting (Render / Railway):** The Express.js backend (which requires long-lived WebSocket connections) runs perfectly on Render's Web Services tier. 
- **Database (Supabase):** Handles the high-concurrency PostgreSQL data storage, fully decoupled from the compute layers.

---

## 📂 Project Structure

```text
Q_Sync/
│
├── frontend/                # React.js (Vite) PWA Client
│   ├── src/
│   │   ├── components/      # UI Components (Wait Screen, QR Scanner)
│   │   ├── App.jsx          # Main Routing & Session Wrapper
│   │   └── index.css        # TailwindCSS Configuration
│
├── backend/                 # Node.js + Express + Socket.io Server
│   ├── routes/
│   │   └── vendors.js       # Vendor REST APIs
│   ├── db.js                # PostgreSQL Connection Pool
│   ├── server.js            # Express & Socket.io Entry Point
│   ├── socket.js            # Penalty Shift & Call Logic
│   └── schema.sql           # Database Table Definitions
```

## 🛠️ Phases of Development
1. **Phase 1:** Vendor Specifications & Core Queue Algorithm (Database schemas, REST APIs, Penalty Shift logic).
2. **Phase 2:** Customer Experience & Real-Time UI (React PWA, WebSockets, Live Wait Screen).
3. **Phase 3:** Super Admin Dashboard (Metrics, Vendor Moderation, RBAC).
