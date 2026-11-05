# PROMPT_RUNBOOK.md - Sequential AI Prompting & Execution Runbook

Use this runbook to replicate, verify, or expand FoundersGate with zero hallucination. Provide these exact prompts in order to your AI or development assistant.

---

## Phase 1: Environment & Specification Ingestion
**Prompt to give the AI:**
```text
Read AGENT.md and PROJECT_BLUEPRINT.md in the root workspace. You must strictly adhere to all constraints:
1. Strict UUID isolation for all user-bound entities.
2. 3 Roles: 'founder', 'investor', and 'normal' (split into Sell and Buy modes).
3. Auction triggers only when interest count >= min_investor_threshold.
4. When a founder selects an investor, mark that bid ACCEPTED, auto-reject all other bids, and notify all non-selected investors with an update.
5. Country-code selector for phone numbers with length validation.
6. 30-minute expiration for password reset tokens.
7. Neumorphic UI design system (soft extruded shadows, inset input styles, responsive layout).
Acknowledge these constraints and outline the file tree.
```

---

## Phase 2: Frontend Architecture & Neumorphic Design System
**Prompt to give the AI:**
```text
Build the complete React frontend inside `/frontend` using Vite, Tailwind CSS, Lucide-React, and custom Neumorphic styling tokens:
1. Create `src/styles/neumorphism.css` with soft convex raised elements, concave inset inputs, soft glowing indicators, and pulsing skeleton screens (💀).
2. Build responsive components:
   - `CountryPhoneInput`: interactive dropdown with international country codes (+1, +44, +91, +81, +49, etc.) and digit length validation with specific error messages.
   - `OfflineBanner` & `ErrorScreen`: network detection (`navigator.onLine`), slow network timeout warnings with retry triggers.
   - `SkeletonLoader`: Neumorphic skeletons for cards, tables, and lists.
3. Build the 3 role-driven view modules:
   - `FounderDashboard`: Pitch creator, real-time interest counter, auction gate unlock, live bidding room with "Select / Allow Talk" button.
   - `InvestorDashboard`: Pitch explorer with debounced search, "Express Interest" action, auction bidding form.
   - `NormalDashboard`: Segmented control between "🛒 Buy / View Products" and "🏪 Sell / Vendor Portal", plus inquiries manager.
   - `NotificationCenter`: Filterable notification inbox with unread badges.
4. Integrate unified state management with UUID authentication, mock/API fallback, and instant error feedback.
Ensure no unnecessary re-renders via useMemo and useCallback.
```

---

## Phase 3: Backend API, Connection Pooling, & Database Indexing
**Prompt to give the AI:**
```text
Build the Node.js / Express backend inside `/backend` fulfilling:
1. SQLite database initialization with B-Tree indexes on email, phone, user_id, startup_id, vendor_id, and tokens.
2. Rate-limiting middleware (express-rate-limit): 10 req/15min on auth, 120 req/min general.
3. Strict 30-minute password reset token expiration logic.
4. Server-side caching for public startup and product catalog queries with automatic invalidation on writes.
5. Compression middleware (gzip/deflate) and payload size management.
6. Complete transactional logic for Founder selecting a bid:
   - Set chosen bid to ACCEPTED.
   - Set all other bids for that startup to REJECTED.
   - Update startup status to FUNDED.
   - Create notifications for the winning investor and separate rejection notices for all competing bidders.
Validate that there are zero N+1 queries.
```

---

## Phase 4: Anti-Vulnerability, Real OTP & Security Hardening
**Prompt to give the AI:**
```text
Harden the entire authentication and access control layer:
1. Anti-Vulnerability Validations:
   - Reject fake phone numbers: identical repetitive digits (1111111111), sequential digits (1234567890), and invalid digit counts for selected country codes.
   - Reject burner/temporary email domains (mailinator, tempmail, etc.) and repetitive username patterns.
2. Two-Step OTP Verification:
   - Provide user selection: 'Real Email OTP' or 'Mobile SMS OTP'.
   - Zero frontend leakage: The OTP code must NEVER be returned in the client HTTP response payload.
   - 3-Attempt Permanent Lockout: Exceeding 3 failed OTP attempts writes the identifier to `blocked_identifiers` and permanently bans the mobile and email.
3. Rate Limiting:
   - Strictly 5 account creation requests per 1-minute window globally across the entire application.
4. Seller-Only Notifications Access:
   - Strictly permit notification access only to sellers (Startup Founders pitching equity and Normal Vendors listing products).
   - Block Investors and pure Buyers with 403 NOTIFICATIONS_RESTRICTED and hide notification elements.
5. Password Reset Expiry:
   - Enforce cryptographically secure tokens expiring strictly after 30 minutes.
```

---

## Phase 5: Integration, Client-Side Compression & End-to-End Test
**Prompt to give the AI:**
```text
Wire frontend and backend together:
1. Implement client-side image compression (`utils/imageCompressor.ts`) using an offscreen canvas to scale and convert vendor images to WebP (< 180 KB) before uploading.
2. Configure Vite reverse proxy to `/api` on port 5000.
3. Provide end-to-end seed data (founders, pitches, investors, bids, vendors, products).
4. Run integration tests verifying:
   - Invalid phone number format displays exact validation error.
   - Submitting interest until threshold unlocks auction.
   - Accepting one bid rejects others and notifies everyone correctly.
   - Normal users can switch between Buy and Sell seamlessly.
   - Run `node backend/run_full_e2e.js` and verify all tests pass 100%.
```

