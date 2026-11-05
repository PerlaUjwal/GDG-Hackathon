# FoundersGate 🚀
> **Next-Gen Startup Auction Engine & Hyperlocal Community Marketplace**
> Featuring Neumorphic UI Design, Strict UUID Isolation, Indexed SQL Core, and Enterprise Resiliency.

---

## 🌟 Key Features

### 1. 🏢 Startup & Investor Auction Engine
- **Founder Pitching Portal**: Post startup visions with valuation, target funding, and investor threshold.
- **Investor Interest Gathering**: Investors register interest; when threshold is satisfied, the **Live Auction Room** unlocks.
- **Competitive Bidding**: Investors bid with capital and requested equity/terms.
- **Single-Winner Selection ("Allow / Talk")**:
  - Founder selects their chosen investor.
  - The winning bid transitions to `ACCEPTED`.
  - All competing bids transition atomically to `REJECTED`.
  - Individual notifications are dispatched to all participants.

### 2. 🏪 Community Marketplace (Normal Person Portal)
- Accessible only when logging in as a "Normal" user.
- **Two Exclusive Sub-Modes**:
  - 🛒 **Buy / View Mode**: Browse local vendor items, search with debouncing, send direct product inquiries to vendors with your phone and message.
  - 🏪 **Sell / Vendor Portal**: List products with compressed WebP photos, manage stock and pricing.
  - 🔔 **Vendor Request Center**: Vendors review inquiries and communicate directly with buyers. (No startup auction mechanics in this portal).

### 3. 🛡️ Anti-Vulnerability, Security & Verification
- **Phone Validation & Country Picker**:
  - Country code selection (`+1`, `+44`, `+91`, `+49`, `+81`, etc.) with length verification.
  - Hard rejection of repetitive digits (e.g. `1111111111`), sequential numbers (e.g. `1234567890`), or invalid patterns (>70% same digit).
- **Email Anti-Vulnerability Filter**:
  - Rejection of disposable/temporary/burner domains (`mailinator.com`, `tempmail.com`, `guerrillamail.com`, etc.).
  - Rejection of repetitive local part patterns (`aaaaaaa@gmail.com`).
- **Real OTP Two-Step Verification**:
  - User can choose verification channel: `Real Email OTP` or `Mobile SMS OTP`.
  - **Zero Frontend Leakage**: OTP code is handled server-side only; never returned in HTTP JSON responses.
  - **3-Attempt Permanent Lockout**: 3 failed OTP entries permanently blacklists both the mobile number and email address (`BLOCKED_PERMANENTLY`).
- **Global Rate Limiting**: Maximum 5 account creation requests per 1 minute globally.
- **Strict Role Isolation & Seller-Only Notifications**:
  - Notifications are restricted exclusively to sellers (Founders pitching equity & Normal vendors listing products).
  - Investors and pure Buyers have notifications blocked and hidden (API returns 403 `NOTIFICATIONS_RESTRICTED`).
  - Strict user UUID locking prevents any cross-tenant data leakage.
- **30-Minute Password Reset**:
  - Inline reset via verification code with 30-minute token validity.

### 4. 🎨 Neumorphic Design System & UX
- Soft tactile UI with dual convex/concave shadows, inset inputs, glowing indicator pills, and pulsing skeletons (💀).
- Resilience screens: Offline mode banner, slow-connection/timeout detector, error boundaries.

### 5. 🔥 Firebase Studio / Cloud Firestore & Auth Integration
- **Hybrid Realtime Backend**:
  - Connect your **Firebase Studio / Firebase Console** project in seconds.
  - Automatic detection: When credentials are configured in `frontend/.env`, the app seamlessly authenticates through **Firebase Auth** and stores profiles in **Cloud Firestore** (`/users/{uid}`).
  - Live Realtime Sync: Firestore subscriptions enabled for live pitches and bids.
  - Zero-friction fallback: If Firebase keys are not set, the app continues to operate on the local high-speed indexed engine.

### 6. ⚡ Performance & Production Readiness
- **Database Indexing**: B-tree / Map-indexed tables on email, phone, UUIDs, foreign keys.
- **Server-Side Caching**: In-memory caching for public pitches and product listings.
- **Client-Side Image Compression**: Shrinks vendor product photos via HTML5 Canvas to WebP (< 180 KB) before upload.
- **Payload Compression**: Express Gzip/Deflate compression enabled.
- **Zero N+1 Queries**: Relational joins with eager aggregation.
- **Code Splitting & Lazy Loading**: Dynamic chunking via Vite and `React.lazy`.

---

## 🔥 How to Connect Your Firebase Studio / Firebase Project

Follow these 4 simple steps to connect your Firebase project:

### Step 1: Open Firebase Studio / Console
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Add project** (or select your existing project) and name it (e.g., `foundersgate-prod`).

### Step 2: Enable Firebase Authentication
1. In the left navigation menu, click **Build** > **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, enable:
   - **Email/Password**: Toggle ON and click **Save**.
   - (Optional) **Phone**: Toggle ON for SMS phone verification.

### Step 3: Enable Cloud Firestore Database
1. In the left navigation menu, click **Build** > **Firestore Database**.
2. Click **Create database**, choose your nearest cloud location (e.g., `nam5 (us-central)` or `asia-south1`), and select **Start in test mode** for initial setup.
3. Click **Enable**.

### Step 4: Register Web App & Paste Keys
1. In your Firebase Project Overview, click the **Project Settings (⚙️ Gear Icon)** > **General**.
2. Scroll down to **Your apps** and click the **Web icon (`</>`)**.
3. Name your app (e.g., `FoundersGate Web`) and click **Register app**.
4. Firebase will display your `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "foundersgate.firebaseapp.com",
     projectId: "foundersgate",
     storageBucket: "foundersgate.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
5. Open `frontend/.env` in your editor and paste the values into the corresponding variables:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=foundersgate.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=foundersgate
   VITE_FIREBASE_STORAGE_BUCKET=foundersgate.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```
6. Save the file. The Vite dev server will instantly reload, and the banner will switch to:
   **`🔥 Firebase Studio & Cloud Firestore Active`**!

---

## 🔑 Test Credentials (Pre-Seeded)

| Role | Name | Email | Country Code & Phone | Password | Notification Access |
|---|---|---|---|---|---|
| **Founder** | Alex Vance | `alex@nexusai.io` | `+1 5550192834` | `Password123!` | ✅ Enabled (Sellers) |
| **Investor** | Elena Rostova | `elena@apexventures.com` | `+1 5550183746` | `Password123!` | ❌ Restricted (Investor) |
| **Normal (Vendor)** | Marco Rossi | `marco@rossibakery.com` | `+1 5550148291` | `Password123!` | ✅ Enabled (Sellers) |

---

## 🧪 Verification & Automated Testing

Run the full end-to-end integration and anti-vulnerability test suite:
```bash
node backend/run_full_e2e.js
```

The test validates:
1. Rejection of fake/repetitive/sequential phone numbers.
2. Rejection of burner/disposable emails and repetitive usernames.
3. Secure OTP dispatch without exposing verification codes to clients.
4. Permanent blacklisting after 3 failed OTP attempts.
5. Strict seller-only notification access control (403 for investors, 200 for founders).
6. Startup auction creation, bidding, and "Allow / Talk" winner selection with automated rejections.

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies
```bash
# In frontend directory
cd frontend
npm install

# In backend directory
cd ../backend
npm install
```

### Step 2: Start Development Servers
```bash
# Terminal 1 - Backend (Port 5000)
cd backend
npm run dev

# Terminal 2 - Frontend (Port 5173)
cd frontend
npm run dev
```

Visit `http://localhost:5173` to explore the app.

