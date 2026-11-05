# AGENT.md - System Constraints, Domain Invariants & Execution Rules

## 1. MISSION STATEMENT
This document serves as the single source of truth (SSOT) for any AI agent or software engineer working on **FoundersGate** (Startup Auction & Community Marketplace). All code generation, refactoring, and feature additions MUST strictly respect the invariants defined herein.

---

## 2. DOMAIN INVARIANTS (NON-NEGOTIABLE)

### A. Strict UUID Isolation
- All entity primary keys MUST be RFC 4122 compliant UUID v4 strings.
- A user can ONLY modify, query, or mutate resources tied to their own authenticated `user_id`.
- Any endpoint receiving a request for another user's resource MUST return `403 Forbidden` or `404 Not Found`.

### B. User Roles & Workflows
1. **Startup Founder (`role: "founder"`)**:
   - Can register startup pitch (title, description, valuation, funding target, investor threshold).
   - Receives investor interest requests.
   - **Auction Unlock Rule**: When the count of unique interested investors is `>= min_investor_threshold` (default 3), the startup enters status `AUCTION_ACTIVE`.
   - **Founder Decision Rule**: In an active auction, the founder views bids. When the founder clicks "Select / Allow Talk", that investor's bid is marked `ACCEPTED`. All other active bids are atomically transitioned to `REJECTED`, and the startup transitions to `FUNDED`.
   - Notifications: Rejection notification dispatched to all non-selected investors: *"Founder selected another proposal"*. Approval notification dispatched to the winner.

2. **Investor (`role: "investor"`)**:
   - Browses pitches.
   - Clicks "Express Interest" (registers willingness to invest).
   - If startup threshold is unlocked, places bids containing:
     - `bid_amount` ($ or currency)
     - `equity_demanded` (%)
     - `conditions` (milestones/advisory)
   - Cannot bid on their own startup.
   - Bids are immutable once founder accepts.

3. **Normal Person / Community Marketplace (`role: "normal"`)**:
   - Never participates in startup auctions.
   - Exclusively accesses the 2-in-1 portal:
     - **Sell Mode**: Small vendors & local businesses list catalog items with title, description, price, image, and inventory.
     - **Buy / View Mode**: Browse listings, submit product inquiries directly to the vendor with message and phone number.
   - Notifications: Vendors receive real-time notifications for incoming inquiries with buyer contact information.

---

## 3. AUTHENTICATION & SECURITY RULES

1. **Phone Number & Country Code**:
   - Registration requires selecting an ISO-standard country code (e.g., `+1 US`, `+44 UK`, `+91 IN`, `+49 DE`, `+81 JP`) and an input validated for minimal and maximal digit length.
   - Frontend and backend must yield distinct error codes for:
     - `INVALID_PHONE_LENGTH`
     - `DUPLICATE_PHONE`
     - `INVALID_CREDENTIALS`

2. **Password Reset Expiration**:
   - Password reset tokens expire **strictly after 30 minutes** (`expires_at < Date.now()`).
   - Tokens can only be used once (invalidated upon consumption).

3. **Rate Limiting**:
   - Auth endpoints (`/api/auth/*`): max 10 requests per 15 minutes per IP.
   - General API endpoints: max 120 requests per minute per IP.
   - Exceeding returns `429 Too Many Requests` with `Retry-After` header.

---

## 4. UI/UX REQUIREMENTS: NEUMORPHIC DESIGN SYSTEM

- **Aesthetic**: Soft Neumorphism / Soft UI.
  - Base canvas: `#e2e8f0` / `#e0e5ec` (light mode) or `#1e232d` / `#181b22` (dark mode).
  - Raised elements (Cards, Buttons): Convex dual shadows (light highlight top-left, soft shadow bottom-right).
    - `box-shadow: 6px 6px 12px #b8b9be, -6px -6px 12px #ffffff`
  - Inset elements (Input fields, active pressed buttons): Concave dual shadows.
    - `box-shadow: inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff`
  - Subtle transitions (`transition: all 0.2s ease-in-out`).

- **Error States & Resiliency**:
  - Offline status detection (`navigator.onLine` / window events) showing prominent Neumorphic alert.
  - Timeout state (exceeding 8000ms) with interactive "Try Again" button.
  - Skeleton screens (💀) with pulsing neumorphic grooves for cards and lists during fetch.
  - Anti-vulnerability error screens for invalid/sequential/repetitive phone numbers, burner/disposable email addresses, and permanent lockout screen after 3 failed OTP attempts.

---

## 5. ANTI-VULNERABILITY & SECURITY MANDATES

- **Strict User UUID Isolation**: Users can never query or manipulate objects outside their own authenticated UUID.
- **Phone Number Validation**:
  - Country code selector (`+1`, `+44`, `+91`, etc.) with strict length validation.
  - Rejection of identical repetitive digits (e.g., `1111111111`, `9999999999`).
  - Rejection of sequential digits (e.g., `1234567890`, `0123456789`).
  - Rejection of invalid patterns (>70% same digit).
- **Email Validation & Blacklisting**:
  - RFC 5322 compliance.
  - Domain blacklist rejecting disposable/temporary/burner email domains (`mailinator.com`, `tempmail.com`, `guerrillamail.com`, etc.).
  - Rejection of repetitive usernames (e.g. `aaaaaaa@gmail.com`).
- **OTP Verification Protocol**:
  - User can choose OTP verification channel: `Real Email OTP` or `Mobile SMS OTP`.
  - **Zero Frontend Leakage**: The verification code is NEVER transmitted in the API response or exposed in frontend code. It is securely handled server-side.
  - **3-Attempt Permanent Blacklist**: If an OTP verification fails 3 times, the associated mobile number and email address are written to `blocked_identifiers` and permanently blocked from account creation or login (`BLOCKED_PERMANENTLY`).
- **Global Rate Limiting**:
  - Maximum of 5 registration attempts per 1-minute window across the entire platform.
- **Strict Seller-Only Notifications**:
  - Notifications are strictly restricted to sellers (Startup Founders pitching equity and Normal Vendors listing products).
  - Investors and pure Buyers are blocked from notifications (bell icon hidden in UI; API endpoint returns 403 `NOTIFICATIONS_RESTRICTED`).
- **Password Reset Window**:
  - Secure tokens expire strictly after 30 minutes.

---

## 6. PERFORMANCE & ARCHITECTURAL MANDATES

- **No N+1 Queries**: Relational reads must utilize SQL `JOIN` or eager grouped aggregation.
- **Indexed Database**: Explicit B-Tree indexes on `users(email)`, `users(phone_number)`, `startups(founder_id)`, `auction_bids(startup_id)`, `products(vendor_id)`, `notifications(user_id, read)`.
- **Client-Side Image Compression**: Compress product images using Canvas/WebP before transmission to stay under 180KB.
- **Debounced Inputs**: Search filters debounced by 300ms.
- **Server Caching**: In-memory LRU / TTL cache (60s) for non-personalized public catalogs.
- **Code Splitting & Lazy Loading**: Dynamic imports for major view components (`React.lazy`).

