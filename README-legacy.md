# TBO Assemble — The Operating System for Group Travel

> **VOYAGEHACK 3.0 Submission** | Team IIITDards

AI-orchestrated Group Inventory Management Platform for MICE conferences, destination weddings, and corporate retreats. Smart room-block allocation, real-time attrition tracking, and automated guest communication — all in one platform.

**🚀 Live Demo:** [https://tbo-assemble-production.up.railway.app](https://tbo-assemble-production.up.railway.app)

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7.4-2D3748?logo=prisma)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)
![GPT-4o](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai)
![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)
![Recharts](https://img.shields.io/badge/Recharts-3.7-FF6384)
[![Live](https://img.shields.io/badge/Railway-Deployed-0B0D0E?logo=railway)](https://tbo-assemble-production.up.railway.app)

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Core Features](#core-features)
- [Product Pages](#product-pages)
- [Landing Page](#landing-page)
- [Microsite Features](#microsite-features)
- [Dashboard Features](#dashboard-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [API Reference](#api-reference-42-routes)
- [Component Library](#component-library)
- [Animations & Design System](#animations--design-system)
- [Internationalisation (i18n)](#internationalisation-i18n)
- [Security & Validation](#security--validation)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Team](#team)

---

## Problem Statement

India's group travel industry manages **thousands of crore** in hotel room blocks annually — yet most agents still rely on **spreadsheets, WhatsApp groups, and manual emails**. This leads to:

| Pain Point | Impact |
| ---------- | ------ |
| Missed attrition deadlines | Heavy penalty charges (10–30% of block value) |
| Manual guest allocation | 4–6 hours wasted per event |
| Clunky reservation processes | High booking drop-off rates |
| Zero real-time visibility | Revenue leakage and overcommitment |

---

## Solution

TBO Assemble replaces this chaos with an intelligent, end-to-end platform in three simple steps:

```
1. UPLOAD    → Hotel contract PDF + event invitation
               AI extracts everything in <60 seconds

2. CUSTOMISE → Adjust room blocks, add-ons, attrition rules
               Auto-generates a branded event microsite

3. GO LIVE   → Share the microsite link with guests
               Monitor bookings in real-time, auto-nudge pending guests
```

> **"What takes 3 days manually, TBO Assemble does in 30 minutes."**

---

## Core Features

### 🤖 GenAI Contract Parsing (GPT-4o + Local OCR Fallback)

Upload a hotel contract PDF and event invitation document. Our intelligent extraction pipeline uses:

1. **PDF Text Extraction** — `pdf-parse` extracts text from digital PDFs
2. **JPEG Page Extraction** — Falls back to image conversion for scanned PDFs
3. **OCR Processing** — `tesseract.js` with `sharp` preprocessing for image-based documents
4. **AI Enhancement** — GPT-4o structures the extracted text into event data

The parser extracts room blocks, negotiated rates, check-in/check-out dates, attrition penalties, venue details, and theme colours — generating a fully branded event microsite in under 60 seconds. Includes **OCR correction patterns** for common scan errors (O→0, l→1, currency symbols), **date validation** to filter impossible dates, and **smart year inference** for dates without explicit years.

### 📋 Contract Template Library

Five pre-configured sample contracts for instant demos — no file upload required:

| Template | Type | Venue |
| -------- | ---- | ----- |
| 🏰 Taj Lake Palace | Destination Wedding | Udaipur |
| 🎯 Marriott Convention | MICE Conference | Bangalore |
| 🏢 ITC Grand Chola | Corporate Retreat | Chennai |
| 💎 Oberoi Amarvilas | Anniversary | Agra |
| 🏖️ La Calypso Resort | College Reunion | Goa |

### 📱 Offline-First Resilience

Both the booking microsite and event creation wizard feature:

- **Network Detection** — Real-time online/offline status monitoring
- **Offline Banner** — Visual indicator when connectivity is lost
- **Form Persistence** — Auto-saves progress to `localStorage` every change
- **Draft Recovery** — Restores interrupted work on page reload (24h for booking, 7 days for events)
- **Graceful Degradation** — Informative error messages for network failures

### 🔄 Cross-Tab Real-Time Sync

Instant dashboard updates when bookings are made from the microsite (even in another browser tab):

- **BroadcastChannel API** — Native browser API for cross-tab communication
- **Auto-Refresh Dashboard** — Event list updates instantly when a new booking is made
- **Check-In Page Sync** — Bookings list refreshes automatically for check-in staff
- **Event Detail Sync** — Server components refresh via `router.refresh()` for accurate stats
- **No Polling Required** — Zero server load, instant updates, works offline-first

### 🏨 Visual Proximity Allocator

Drag-and-drop guest assignment to specific floors, wings, and rooms using `@dnd-kit`. Honours proximity requests ("near the bride's family") with smart visual cues, VIP prioritisation badges, real-time capacity tracking, and AI-powered auto-allocation that explains its reasoning for each placement.

### ⚠️ Smart Yield Protection (Attrition Tracking)

Real-time attrition deadline tracking with visual status timelines. Auto-calculates at-risk revenue in ₹, shows days-until-deadline countdowns, triggers WhatsApp nudges to pending guests, and prevents costly penalties. Visual charts show release dates vs current booking velocity.

### 🎁 Experience Bundling Engine

Dynamic add-on management for airport transfers, gala dinner passes, spa packages, and more. Supports both included (complimentary) and paid add-ons. Generates GST-compliant itemised invoices (18% GST) with "PAID" watermark and printable layout.

### 📱 Branded Event Microsites

Auto-generated, mobile-first public event pages with:

- Countdown timer (days/hours/minutes/seconds)
- Room block cards with real-time availability
- Self-service multi-step booking flow (room → details → add-ons → review → confirm)
- QR code check-in on confirmation
- WhatsApp share & copy-link buttons
- Social proof popups ("12 guests confirmed", "Rooms filling fast!")
- Fixed mobile bottom navigation bar
- Language toggle (English/Hindi)

### 📊 Comparative Analytics

Cross-event analytics dashboard powered by Recharts with:

- Occupancy rate tracking (pie charts, bar charts)
- Revenue trend analysis
- Booking velocity curves
- Demographic breakdowns
- PDF report export (popup-safe with fallback alert)
- Dark mode-optimised chart colours

### 📅 Calendar View

Month calendar grid visualising all events with colour-coded dots. Shows event date ranges, attrition deadlines, and check-in/check-out windows at a glance.

### ✅ QR Code Check-In System

- Batch QR generation per event (one QR per booking)
- Manual booking ID search fallback
- Bulk check-in mode (up to 200 guests at once)
- Real-time check-in counter with progress bar
- Guest status auto-synced on check-in (Booking + Guest both updated)
- Confetti celebration animation on successful check-in

### 💬 WhatsApp Nudges & Notifications

Simulated WhatsApp message flows for:

- Booking confirmations
- Attrition deadline reminders
- Pending guest nudges
- Custom messages with guest name personalisation

### 🔄 Room Upgrade / Downgrade

Self-service room upgrade portal. Guests can switch room types with instant price recalculation. Discount rules are automatically re-applied after upgrade to ensure correct pricing.

### 💰 Volume Discount Rules

Create event-level discount rules (e.g., "Book 10+ rooms, get 15% off"). Rules auto-apply during booking creation. CRUD management with inline delete confirmation (double-click safety pattern with 3-second auto-cancel).

### 📋 Waitlist Management

When room blocks sell out, guests can join a waitlist. Queue position tracking with automatic notification readiness when rooms free up.

### 📥 Bulk Guest Import (CSV)

Upload CSV with guest details. Batch validation + creation in a single transaction. Supports up to 500 guests per import with field validation (name, email, phone, group, notes).

### 📄 CSV Rooming List Export

Export the full rooming list as a downloadable CSV with proper escaping. Includes guest name, email, room type, floor, wing, status, and check-in time.

### 🌐 Multi-Language Support (i18n)

Full English and Hindi language toggle across the entire platform. 120+ translation keys covering 21 categories:

- Microsite UI, booking flow, invoice labels, feedback form
- Guest status labels, event types, error messages
- Social proof, urgency indicators, discount badges
- Locale persisted to `localStorage` across sessions

### ⌨️ Keyboard Shortcuts

Power-user navigation overlay (press `?` to open):

| Shortcut | Action |
| -------- | ------ |
| `Alt + D` | Go to Dashboard |
| `Alt + N` | Create New Event |
| `Alt + K` | Open Calendar |
| `Alt + A` | Open Analytics |
| `?` | Show Shortcuts Overlay |
| `Esc` | Close Modal / Cancel |
| `Tab` | Navigate Between Fields |

### 🌙 Dark Mode

Full dark mode support with:

- Class-based toggle with system preference detection
- Flash-prevention script (`<ThemeScript>`) in document head
- Theme persisted to `localStorage`
- All components, charts, and microsites dark-mode optimised

### 🔔 Notification System (Demo)

Realtime notification bell with:

- Unread count badge
- Warning / success / info notification types
- "Mark all read" action
- Keyboard-accessible (Escape to close)
- Live collaboration indicator (demo mode labeled)

### 📊 Activity Log & Audit Trail

Chronological event log tracking every action: guest additions, booking creations, status changes, check-ins, nudges sent, room allocations, and more. Whitelist of 19 allowed action types with HTML sanitisation and length limits.

### 🔄 Reset Demo

One-click database reseed via sidebar "Reset Demo" button or `POST /api/seed`. Restores two demo events with realistic Indian data for presentation purposes.

---

## Product Pages

### Public Pages

| Page | URL | Description |
| ---- | --- | ----------- |
| **Landing Page** | `/` | Full marketing site with 14 sections, particle background, animated hero, comparison table, testimonials |
| **Event Microsite** | `/event/[slug]` | Branded public event page with countdown, rooms, add-ons |
| **Booking Flow** | `/event/[slug]/book` | Multi-step self-service booking (5 steps) |
| **Feedback Form** | `/event/[slug]/feedback` | Post-event star rating + comments |
| **Booking Portal** | `/booking/[id]` | Self-service: view details, cancel, upgrade, download QR |
| **Invoice** | `/booking/[id]/invoice` | GST-compliant printable invoice with "PAID" watermark |
| **Login** | `/login` | Agent authentication with demo credentials |

### Dashboard Pages (Protected)

| Page | URL | Description |
| ---- | --- | ----------- |
| **Dashboard Home** | `/dashboard` | Overview with event cards, KPIs, search, filters |
| **AI Onboarding** | `/dashboard/onboarding` | 60-second event creation with AI contract parsing |
| **Event Detail** | `/dashboard/events/[id]` | Full event management hub with tabs |
| **Guest Management** | `/dashboard/events/[id]/guests` | Guest list with search, filters, inline editing, CSV import |
| **Room Allocator** | `/dashboard/events/[id]/allocator` | Visual drag-and-drop floor/wing allocator |
| **Attrition Tracker** | `/dashboard/events/[id]/attrition` | Deadline alerts, at-risk revenue, WhatsApp nudger |
| **Inventory** | `/dashboard/events/[id]/inventory` | Room block availability grid |
| **Check-In** | `/dashboard/events/[id]/checkin` | QR scanner + manual search + bulk check-in |
| **Activity Log** | `/dashboard/events/[id]/activity` | Chronological audit trail |
| **Feedback** | `/dashboard/events/[id]/feedback` | Guest sentiment & reviews dashboard |
| **Analytics** | `/dashboard/analytics` | Cross-event comparative analytics |
| **Calendar** | `/dashboard/calendar` | Month calendar with event visualisation |

---

## Landing Page

The landing page (`/`) is a **956-line, fully animated marketing experience** with 14 distinct sections:

1. **Interactive Particle Background** — Mouse-reactive canvas with 60 particles (25 on mobile), connected with lines <160px apart, orange tint, mouse repulsion at 120px radius
2. **Sticky Navigation** — Logo, section links (Features / How it Works / Feedback / Impact), Sign In + shimmer CTA
3. **Trust Marquee** — Auto-scrolling banner: AI Contract Parsing, Room Block Management, Visual Guest Allocator, Attrition Tracking, QR Check-In, WhatsApp Nudges, Auto Invoicing, Wedding & MICE, Real-Time Analytics, Branded Microsites
4. **Hero Section** — Animated gradient blobs, floating badges ("AI-Powered", "60s Setup", "Live Tracking"), gradient-animated headline, dual CTAs with glow effect
5. **Stats / Impact** — 4 animated counters: **4** Core Modules · **13** Prisma Models · **42+** API Endpoints · **60s** AI Setup Time
6. **Features Bento Grid** — "Four Pillars of Intelligence" with 3D tilt cards
7. **How It Works** — 3-step flow with connector lines and floating decorative elements
8. **Use Cases** — 6 tilt cards: Destination Weddings, MICE Conferences, Sports Tournaments, College Fests, Religious Pilgrimages, Film Shoots
9. **Testimonials** — 3 five-star review cards from early testers (Priya Sharma, Arjun Mehta, Neha Kapoor)
10. **Problem vs Solution** — Side-by-side comparison highlighting 4 pain points vs 6 benefits
11. **Tech Stack Showcase** — 6 gradient cards for Next.js, GPT-4o, Prisma 7, TypeScript, Tailwind v4, Recharts
12. **Comparison Table** — 8-row "Manual Coordination vs TBO Assemble" feature comparison
13. **CTA Section** — Dark card with animated blobs and dual action buttons
14. **Footer** — 4-column grid with product links, demo events, tech stack, copyright

All sections use **scroll-reveal animations** via IntersectionObserver (`threshold: 0.12`).

---

## Microsite Features

Each event generates a branded public microsite at `/event/[slug]` with:

| Feature | Description |
| ------- | ----------- |
| **Countdown Timer** | Live countdown to event start (days/hours/min/sec) with compact mode |
| **Room Block Cards** | Real-time availability with pricing, floor/wing info, sold-out states |
| **Multi-Step Booking** | 5-step flow: Room Select → Guest Details → Add-Ons → Review → Confirm |
| **Confetti Celebration** | Particle explosion on booking confirmation |
| **QR Code** | Auto-generated QR for check-in, downloadable |
| **Copy Link** | One-click URL copy with check icon feedback |
| **WhatsApp Share** | Pre-formatted share message with event name and URL |
| **Social Proof Popups** | Rotating notifications ("X guests confirmed", "Rooms filling fast!", "Special group rates") — dismissible with ✕ button |
| **Mobile Bottom Nav** | Fixed bottom bar with Feedback + Reserve Room buttons (mobile only) |
| **Language Toggle** | 🇮🇳/🇬🇧 flag button to switch EN↔HI |
| **Status Timeline** | Visual booking status progression |
| **Group Discounts** | Auto-applied volume discounts with "Best Value" badges |
| **Server-Side Pricing** | Total computed server-side — client cannot manipulate prices |
| **Offline Resilience** | Auto-saves form progress, displays offline banner, retry logic on network errors |
| **Form Recovery** | Restores guest details from localStorage on page refresh (24h expiry) |
| **Smart Error Messages** | Context-aware error messages: sold out, validation failed, network error, offline |

---

## Dashboard Features

### Sidebar Navigation

- **4 main routes:** Dashboard, Create Event, Calendar, Analytics
- **8 event sub-routes** (auto-expand when inside an event): Overview, Inventory, Guests, Allocator, Attrition, Check-In, Activity, Feedback
- **Keyboard shortcuts** for all main routes (Alt+D/N/K/A)
- User profile with initials avatar, name, and role
- Help + Logout buttons
- **Mobile-responsive:** Hamburger menu with slide-in overlay (w-72)

### Dashboard Header

- Welcome message with user name
- Live status indicator (green pulse dot)
- Collaboration indicator with user avatars (demo mode)
- Notification bell with unread count badge
- Notification dropdown with warning/success/info types and "Mark all read"

### Key Dashboard Components

| Component | Description |
| --------- | ----------- |
| `DashboardClient` | Main dashboard with event cards, KPIs, search, status filters, **cross-tab sync via BroadcastChannel** |
| `EventEditForm` | Full event editing with date validation (check-out > check-in), `router.refresh()` on save |
| `GuestManagement` | Guest list with search, status filters, inline editing, CSV import, individual delete |
| `AllocatorClient` | Drag-and-drop floor/wing guest allocator with `@dnd-kit`, VIP badges, AI auto-allocate with reasoning |
| `AttritionClient` | At-risk revenue display, attrition rule timelines, WhatsApp nudge triggers |
| `CheckinClient` | QR code scanner + manual ID search + bulk mode (up to 200), real-time counter, **cross-tab booking sync** |
| `DiscountRulesClient` | Volume discount CRUD with inline confirm-to-delete (3s auto-cancel) |
| `WhatsAppSimulator` | WhatsApp message preview for nudge templates |
| `AnalyticsCharts` | Recharts-based revenue, occupancy, and booking analytics |
| `ComparativeAnalytics` | Cross-event comparison with dark-mode optimised charts |
| `CalendarView` | Month grid with colour-coded event dots |
| `ActivityLog` | Full audit trail with action icons and relative timestamps |
| `PdfExportButton` | HTML-based printable report generation (popup-safe with blocker alert) |
| `KeyboardShortcutsOverlay` | `?` shortcut help modal with key indicators |

---

## Tech Stack

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| **Framework** | Next.js (App Router, Turbopack) | 16.1.6 |
| **Language** | TypeScript (strict mode) | 5.x |
| **Runtime** | React | 19.2.3 |
| **Database** | Prisma + SQLite (`@prisma/adapter-better-sqlite3`) | 7.4.0 |
| **AI** | OpenAI GPT-4o via `openai` SDK | 6.21.0 |
| **PDF Parsing** | pdf-parse | 1.1.1 |
| **OCR** | tesseract.js (local OCR, no cloud dependency) | 6.x |
| **Image Processing** | sharp (preprocessing for OCR) | 0.x |
| **Styling** | Tailwind CSS v4 + PostCSS | 4.x |
| **UI Primitives** | Radix UI (Dialog, Dropdown, Tabs, Toast, Tooltip, Switch, Progress, Select, Label, Slot) | Various |
| **Component Variants** | class-variance-authority (CVA) | 0.7.1 |
| **Charts** | Recharts | 3.7.0 |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities | 6.3.1 / 10.0.0 |
| **Auth** | NextAuth.js | 4.24.13 |
| **Icons** | Lucide React | 0.563.0 |
| **Dates** | date-fns | 4.1.0 |
| **Fonts** | Geist (via `next/font`) | — |
| **Utilities** | clsx, tailwind-merge, uuid | Various |

**Total:** 24 production dependencies + 12 dev dependencies.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         NEXT.JS 16                           │
│                    App Router + Turbopack                     │
├──────────────────────┬───────────────────────────────────────┤
│   PUBLIC PAGES       │        DASHBOARD (AuthGuard)          │
│                      │                                       │
│  / (Landing)         │  /dashboard (Home + KPIs)             │
│  /event/[slug]       │  /dashboard/onboarding (AI Setup)     │
│  /event/[slug]/book  │  /dashboard/events/[id] (8 sub-tabs)  │
│  /event/[slug]/feed  │  /dashboard/analytics (Comparative)   │
│  /booking/[id]       │  /dashboard/calendar (Month Grid)     │
│  /booking/[id]/inv   │                                       │
│  /login              │                                       │
├──────────────────────┴───────────────────────────────────────┤
│                    API LAYER (42+ Routes)                     │
│                                                              │
│  /api/ai/parse       /api/events/*      /api/bookings/*      │
│  /api/guests/*       /api/waitlist      /api/seed            │
├──────────────────────────────────────────────────────────────┤
│                   PRISMA 7 (ORM Layer)                       │
│        13 Models • $transaction • Type-safe queries          │
├──────────────────────────────────────────────────────────────┤
│               SQLite (better-sqlite3 adapter)                │
│             Zero-config • File-based • dev.db                │
└──────────────────────────────────────────────────────────────┘
          │                                     │
   ┌──────┴──────┐                      ┌───────┴───────┐
   │  OpenAI     │                      │  Recharts     │
   │  GPT-4o     │                      │  Analytics    │
   │  pdf-parse  │                      │  Dark-mode    │
   └─────────────┘                      └───────────────┘
```

### Auth Flow

- **Client-side demo auth** via React Context + `localStorage`
- Storage key: `"tbo-auth"`, synced across tabs via `StorageEvent`
- `<AuthGuard>` wraps entire dashboard layout — redirects to `/login` if unauthenticated
- **Demo credentials:**

| Email | Password | Name | Role |
| ----- | -------- | ---- | ---- |
| `rajesh@tbo.com` | `tbo2026` | Rajesh Kumar | Travel Agent |
| `admin@tbo.com` | `admin123` | Admin User | Administrator |
| `demo@tbo.com` | `demo` | Demo User | Travel Agent |

---

## Data Model

**13 Prisma models** with relationships, cascade deletes, and performance indexes:

```
Agent (1) ──→ (N) Event
                    │
    ┌───────────────┼───────────────────────────────┐
    │               │               │               │
    ▼               ▼               ▼               ▼
 RoomBlock       Guest           AddOn        AttritionRule
 @@index         @@index(email)  @@index
 (eventId)       @@index(status) (eventId)
    │               │
    │          ┌────┤
    │          │    │
    │          ▼    ▼
    │       Nudge  Booking ──→ BookingAddOn
    │              @@index(status)
    │              @@index(guestId)
    │
    ├──────→ Waitlist
    │        @@index(status)
    │        @@index(roomBlockId)
    │
    ├──────→ ActivityLog
    ├──────→ Feedback
    └──────→ DiscountRule
```

### Model Details

| Model | Key Fields | Indexes |
| ----- | ---------- | ------- |
| **Agent** | name, email (unique), password, company | email |
| **Event** | name, slug (unique), type, venue, location, checkIn/Out, primaryColor, secondaryColor, accentColor, heroImageUrl, status (draft/active/published/completed/cancelled) | slug |
| **RoomBlock** | roomType, description, rate, totalQty, bookedQty, floor, wing, hotelName | eventId |
| **Guest** | name, email, phone, group, status (invited/confirmed/checked-in/cancelled), proximityRequest, notes, allocatedFloor/Wing/Room | eventId, email, status |
| **AddOn** | name, description, price, isIncluded | eventId |
| **Booking** | guestId, eventId, roomBlockId, totalAmount, status (confirmed/cancelled), checkedIn, checkedInAt | eventId, guestId, status |
| **BookingAddOn** | bookingId, addOnId, price, quantity | bookingId |
| **AttritionRule** | releaseDate, releasePercent, description, isTriggered | — |
| **Nudge** | guestId, channel (whatsapp), message, sentAt, status | — |
| **Waitlist** | guestName, guestEmail, guestPhone, roomBlockId, status | eventId, status, roomBlockId |
| **ActivityLog** | action, details, actor | eventId |
| **Feedback** | guestName, guestEmail, rating (1-5), stayRating, eventRating, comment | eventId |
| **DiscountRule** | minRooms, discountPct (0-100), description, isActive | eventId |

---

## API Reference (42+ Routes)

### AI & Parsing

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/ai/parse` | Upload hotel contract PDF + invitation → GPT-4o extraction |

### Events

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/events` | List all events with stats |
| `POST` | `/api/events` | Create event (atomic `$transaction`: event + rooms + add-ons + attrition rules) |
| `GET` | `/api/events/search?q=` | Search events by name or slug |
| `GET` | `/api/events/[id]` | Get event with all relations |
| `PATCH` | `/api/events/[id]` | Update event details |
| `PATCH` | `/api/events/[id]/status` | Status transitions (draft → active → published → completed/cancelled) |
| `POST` | `/api/events/[id]/clone` | Deep clone event with all room blocks, add-ons, attrition rules |
| `POST` | `/api/events/[id]/auto-allocate` | AI-powered batch guest allocation (batched `$transaction`) |
| `POST` | `/api/events/[id]/allocate` | Manual room allocation |
| `POST` | `/api/events/[id]/bulk-checkin` | Bulk check-in (up to 200, batch `findMany` + `updateMany`) |
| `POST` | `/api/events/[id]/nudge` | Trigger WhatsApp nudge to pending guests |
| `GET/POST/PATCH/DELETE` | `/api/events/[id]/discount` | Discount rules CRUD (ownership verified) |
| `GET/POST` | `/api/events/[id]/feedback` | Guest feedback (rating 1-5 validated) |
| `GET/POST` | `/api/events/[id]/activity` | Activity log (whitelist of 19 actions, HTML stripped) |
| `GET` | `/api/events/[id]/qr-batch` | Generate batch QR codes for all bookings |
| `GET` | `/api/events/[id]/rooming-list` | Export CSV rooming list |

### Bookings

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/bookings?eventId=` | List bookings (optionally filtered by event) |
| `POST` | `/api/bookings` | Create booking (server-side pricing, discount auto-applied, `$transaction`) |
| `PATCH` | `/api/bookings/[id]` | Update booking (cancel, modify) |
| `POST` | `/api/bookings/[id]/checkin` | QR/manual check-in (updates booking + guest status) |
| `POST` | `/api/bookings/[id]/upgrade` | Room upgrade with discount re-application |

### Guests

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/guests?eventId=` | List guests with filters |
| `POST` | `/api/guests` | Create individual guest |
| `PUT` | `/api/guests` | Update guest (404 check before update) |
| `DELETE` | `/api/guests` | Delete guest (decrements room count only for non-cancelled bookings) |
| `POST` | `/api/guests/import` | Bulk CSV import (up to 500 guests, batched `$transaction`) |
| `GET` | `/api/guests/search?q=&eventId=` | Search guests by name/email |

### Waitlist & System

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET/POST` | `/api/waitlist` | Waitlist management |
| `POST` | `/api/seed` | Reset & seed demo data (2 events with full data) |

---

## Component Library

### UI Components (`src/components/ui/` — 16 files)

| Component | Description |
| --------- | ----------- |
| `AnimatedCounter` | Intersection-observer-triggered count-up animation for stats |
| `Badge` | CVA variant-based badge (default, secondary, destructive, outline) |
| `Button` | CVA button with 6 variants (default, destructive, outline, secondary, ghost, link) and 3 sizes |
| `Card` | Compound card (Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent) |
| `ConfettiExplosion` + `useConfetti` | Particle confetti effect triggered on booking success |
| `Countdown` | Live countdown timer (days/hours/min/sec), compact mode support |
| `EmptyState` | Placeholder with icon, title, description, and CTA action |
| `Input` | Styled form input with consistent theming |
| `PageTransition` | Wrapper with `animate-page-enter` animation for route transitions |
| `Progress` | Radix UI progress bar with themed fill |
| `Skeleton` | Base skeleton shimmer element |
| `DashboardSkeleton` / `EventDetailSkeleton` / `TableSkeleton` | Pre-built skeleton loader layouts for SSR loading states |
| `StatusTimeline` + `buildBookingTimeline` | Visual vertical timeline for booking status progression |
| `ThemeToggle` + `ThemeScript` | Dark/light mode toggle with flash-prevention script |
| `ToastProvider` + `Toaster` + `useToast` | Radix UI toast notification system |

### Dashboard Components (`src/components/dashboard/` — 16 files)

| Component | Description |
| --------- | ----------- |
| `Sidebar` | Full navigation with 4 main routes, 8 event sub-routes, keyboard shortcuts, mobile hamburger |
| `DashboardHeader` | Top header with user welcome, notification bell, live status, collab indicator |
| `DashboardClient` | Main dashboard with event cards, KPIs, search, status filters, **cross-tab booking sync** |
| `EventEditForm` | Full event editing with date validation, `router.refresh()` |
| `GuestManagement` | Guest list with search, filters, inline editing, CSV import, delete |
| `AllocatorClient` | Drag-and-drop floor/wing allocator with @dnd-kit + AI auto-allocate |
| `AttritionClient` | Attrition rules display, at-risk revenue, WhatsApp nudge panel |
| `CheckinClient` | QR scanner + manual search + bulk check-in (up to 200), **cross-tab sync** |
| `DiscountRulesClient` | Volume discount CRUD with inline confirm-to-delete |
| `WhatsAppSimulator` | WhatsApp message preview for nudge templates |
| `AnalyticsCharts` | Recharts-based revenue, occupancy, booking analytics |
| `ComparativeAnalytics` | Cross-event comparison charts (dark-mode optimised) |
| `CalendarView` | Month grid calendar with event dots |
| `ActivityLog` | Full audit trail with action icons and relative timestamps |
| `PdfExportButton` | HTML-based printable report (popup-safe with alert fallback) |
| `KeyboardShortcutsOverlay` | `?`-triggered shortcuts help modal |

### Microsite Component

| Component | Description |
| --------- | ----------- |
| `BookingClient` | Multi-step booking form: Room Select → Guest Details → Add-Ons → Review → Confirm. Features offline detection, form persistence to localStorage, retry logic, payment modal, smart error recovery, and **BroadcastChannel cross-tab sync** to instantly update dashboard |

---

## Animations & Design System

### 20 Custom CSS Animations

| Animation | Description |
| --------- | ----------- |
| `fadeIn` | Fade in with slight Y translate (8px) |
| `slideIn` | Fade in with slight X translate (-12px) |
| `pulse-soft` | Gentle opacity pulse (1 → 0.7 → 1) |
| `reveal-up` | Scroll-triggered reveal: Y 40px + scale 0.98 → normal |
| `float` | 3-point floating: 0, -10px, +5px with rotation |
| `float-reverse` | Reverse floating pattern |
| `shimmer` | Horizontal light sweep for button hover effect |
| `gradient-shift` | Background position cycling for animated gradient text |
| `marquee` | Horizontal scroll for trust marquee (pauses on hover) |
| `glow-pulse` | Box-shadow orange glow expand/contract |
| `border-rotate` | CSS custom property rotation (0° → 360°) |
| `spin-slow` | 20-second full rotation for decorative elements |
| `scale-in` | Scale zoom in (0.9 → 1) with fade for modals |
| `confetti-fall` | Confetti: translateY(0→80vh) + random X + rotate(720°) |
| `page-enter` | Page transition: Y 12px + fade → normal |
| `checkmark-draw` | SVG stroke dash offset animation for success checkmark |
| `success-circle` | Circle scale pop: 0 → 1.1 → 1 |
| `slide-up-nav` | Mobile bottom nav entrance from below |
| `skeleton-shimmer` | Background position shimmer for loading states |
| `social-proof` | Slide up from bottom, hold, then slide up to exit |

### Design System Utilities

| Feature | Implementation |
| ------- | -------------- |
| **Glass Morphism** | `.glass` — backdrop-blur + semi-transparent backgrounds |
| **3D Tilt Cards** | `.tilt-card` — preserve-3d with will-change |
| **Noise Texture** | `.noise::before` — SVG fractal noise overlay |
| **Gradient Text** | `.text-gradient-animated` — 4-colour animated gradient |
| **Invoice Watermark** | `.invoice-watermark::after` — "PAID" diagonal watermark |
| **Particle Network** | Canvas-based mouse-reactive particle system (60 particles) |
| **Scroll Animations** | IntersectionObserver + `.revealed` class transition |
| **Focus Styles** | 2px orange outline on `:focus-visible` |
| **Custom Scrollbars** | WebKit + Firefox styled scrollbars |
| **Selection Colour** | Orange-tinted text selection |

### Accessibility

| Feature | Description |
| ------- | ----------- |
| `prefers-reduced-motion` | All animations disabled when user prefers reduced motion |
| `prefers-contrast: high` | Orange/blue adjusted for high contrast |
| `forced-colors: active` | Shimmer effects hidden |
| Skip-to-content link | `sr-only focus:not-sr-only` on dashboard |
| Keyboard navigation | Full tab + shortcut support |
| ARIA labels | On all interactive elements |
| Touch targets | 44px minimum on mobile |
| iOS zoom prevention | 16px minimum input font size |
| Safe-area insets | Notched phone support |
| Print styles | A4 page, break-inside-avoid, `.no-print` elements hidden |

---

## Internationalisation (i18n)

| Property | Detail |
| -------- | ------ |
| **Languages** | English (`en`) + Hindi (`hi`) |
| **Translation Keys** | 120+ keys across 21 categories |
| **Persistence** | `localStorage("tbo-locale")` — survives page reloads |
| **Toggle UI** | Flag button: 🇮🇳 (Hindi) / 🇬🇧 (English) |
| **Provider** | `<I18nProvider>` wraps microsite and booking pages |
| **Consumer** | `useI18n()` hook + `<T k="key" />` inline component |

### Translation Categories

Microsite UI · Room Selection · Countdown · Booking Flow (5 steps) · Self-Service Portal · Invoice Labels · Feedback Form · Booking Success · Error Messages · Event Schedule · Urgency Indicators · Group Discounts · Booking Deadlines · Bottom Navigation · Social Proof · Event Types · Guest Statuses · Microsite Extras · Branding · Room Upgrade · Demo Mode

---

## Security & Validation

| Protection | Description |
| ---------- | ----------- |
| **Server-Side Pricing** | Total amount computed from room rate × nights + add-on prices. Client `totalAmount` ignored |
| **Atomic Transactions** | Event creation and booking creation wrapped in `prisma.$transaction` |
| **Race Condition Prevention** | Room availability re-checked inside transaction to prevent double-booking |
| **Duplicate Booking Check** | Returns 409 if guest email already has a confirmed booking for the event |
| **Event Status Gate** | Only "active" or "published" events accept bookings |
| **Add-On Ownership** | Validates all selected add-ons belong to the correct event |
| **Input Validation** | Required fields, type checks, length limits on all POST routes |
| **Email Format Validation** | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| **Numeric Range Validation** | Ratings 1-5, discount 0-100%, rooms/rates > 0, dates in order |
| **HTML Sanitisation** | Strips all HTML tags from user input in feedback and activity logs |
| **XSS Prevention** | `escapeHtml()` on all user strings in generated HTML (QR pages, invoices) |
| **Action Whitelist** | Activity log only accepts 19 predefined action types |
| **String Truncation** | Actor names capped at 100 chars, details at 500 chars |
| **Import Limits** | CSV guest import capped at 500 rows, bulk check-in at 200 |
| **Ownership Verification** | Discount rules verified to belong to the event before CRUD operations |
| **404 Safety** | Guest update checks existence via `findUnique` before `update` |
| **Auth Guard** | `<AuthGuard>` protects all dashboard routes, redirects to `/login` |
| **Multi-Tab Sync** | Auth state synced across browser tabs via `StorageEvent` |

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **npm** / yarn / pnpm
- **OpenAI API key** (for AI contract parsing features)

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/tbo-assemble.git
cd tbo-assemble

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    Create .env file with:
#    OPENAI_API_KEY=your_key_here

# 4. Generate Prisma client
npx prisma generate

# 5. Push database schema
npx prisma db push

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

Or visit the live deployment at [https://tbo-assemble-production.up.railway.app](https://tbo-assemble-production.up.railway.app).

### Seed Demo Data

Populate the database with two realistic Indian demo events:

```bash
# Via API:
POST http://localhost:3000/api/seed

# Or use the "Reset Demo" button in the dashboard sidebar
```

### Demo Events (Seeded)

| Event | Type | Slug | Room Types |
| ----- | ---- | ---- | ---------- |
| Grand Hyatt Annual Conference | MICE Conference | `grand-hyatt-annual-conference` | Deluxe, Premium, Suite |
| Royal Rajputana Wedding | Destination Wedding | `royal-rajputana-wedding` | Standard, Heritage, Royal Suite |

### Available Scripts

| Script | Command | Description |
| ------ | ------- | ----------- |
| `dev` | `npm run dev` | Start dev server with Turbopack |
| `build` | `npm run build` | Generate Prisma + production build |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |
| `seed` | `npm run seed` | Seed database via CLI |
| `db:push` | `npm run db:push` | Push Prisma schema to DB |
| `db:studio` | `npm run db:studio` | Open Prisma Studio GUI |

---

## Project Structure

```
tbo-assemble/
├── prisma/
│   └── schema.prisma              # 13 models, indexes, cascade deletes
├── public/
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page (956 lines, 14 sections)
│   │   ├── layout.tsx             # Root layout + Geist fonts + ThemeScript
│   │   ├── globals.css            # Tailwind v4 + 20 animations (542 lines)
│   │   ├── error.tsx              # Global error boundary
│   │   ├── not-found.tsx          # Custom 404 page
│   │   ├── login/                 # Agent login page
│   │   ├── api/                   # 42+ API routes
│   │   │   ├── ai/parse/          # GPT-4o contract parsing
│   │   │   ├── events/            # Event CRUD + 11 sub-routes
│   │   │   ├── bookings/          # Booking CRUD + checkin + upgrade
│   │   │   ├── guests/            # Guest CRUD + import + search
│   │   │   ├── waitlist/          # Waitlist management
│   │   │   └── seed/              # Database reseed
│   │   ├── dashboard/             # Protected dashboard pages
│   │   │   ├── layout.tsx         # AuthGuard + Sidebar + KeyboardShortcuts
│   │   │   ├── page.tsx           # Dashboard home
│   │   │   ├── onboarding/        # AI-powered event creation
│   │   │   ├── analytics/         # Comparative analytics
│   │   │   ├── calendar/          # Month calendar view
│   │   │   └── events/[eventId]/  # Event management (8 sub-pages)
│   │   ├── event/[slug]/          # Public microsites
│   │   │   ├── layout.tsx         # I18nProvider wrapper
│   │   │   ├── page.tsx           # Event microsite
│   │   │   ├── book/              # Booking flow
│   │   │   ├── feedback/          # Feedback form
│   │   │   └── microsite-extras.tsx
│   │   └── booking/[bookingId]/   # Self-service booking portal
│   │       ├── page.tsx           # Booking details + cancel + upgrade
│   │       └── invoice/           # GST-compliant printable invoice
│   ├── components/
│   │   ├── auth-guard.tsx         # Route protection component
│   │   ├── dashboard/             # 16 dashboard components
│   │   ├── microsite/             # BookingClient (multi-step form)
│   │   └── ui/                    # 16 reusable UI components
│   ├── generated/prisma/          # Auto-generated Prisma client
│   └── lib/
│       ├── ai.ts                  # OpenAI integration (GPT-4o)
│       ├── auth-context.tsx       # Auth provider + 3 demo users
│       ├── db.ts                  # Prisma client singleton
│       ├── i18n.tsx               # i18n provider (EN/HI, 120+ keys)
│       └── utils.ts              # Utilities (escapeHtml, daysUntil, cn, etc.)
├── ai_context/                    # AI context documentation
├── package.json                   # 24 deps + 12 devDeps
├── tsconfig.json                  # TypeScript strict config
├── next.config.ts                 # Next.js configuration
├── postcss.config.mjs             # PostCSS + Tailwind v4
├── prisma.config.ts               # Prisma configuration
└── eslint.config.mjs              # ESLint flat config
```

---

## Design Decisions

| Decision | Rationale |
| -------- | --------- |
| **SQLite** | Zero-config deployment — no external database needed for hackathon demo |
| **Prisma 7** | Type-safe database access with `@prisma/adapter-better-sqlite3` |
| **App Router** | `force-dynamic` on API routes for real-time data |
| **Tailwind CSS v4** | Custom CSS animations (particle network, scroll reveal, tilt cards, shimmer buttons) |
| **Radix UI** | Accessible, unstyled UI primitives for Dialog, Toast, Tabs, Progress, etc. |
| **CVA** | Type-safe component variants for Button and Badge |
| **@dnd-kit** | Modern drag-and-drop for room allocation (replaces react-dnd) |
| **Recharts** | Declarative charts with native dark-mode support |
| **Server-side pricing** | Client cannot manipulate totals — all amounts computed from room rates + add-ons |
| **$transaction everywhere** | Atomic operations for event creation, bookings, bulk check-in |
| **Dark mode** | Class-based toggle with system preference + ThemeScript flash prevention |
| **Mobile-first** | Responsive design across all pages with 44px touch targets |
| **Indian locale** | ₹ currency, Indian names, GST invoicing, WhatsApp integration |
| **i18n** | English + Hindi with localStorage persistence for nation-wide accessibility |

---

## Team

**Team IIITDards** — VOYAGEHACK 3.0

---

## Deployed Link

**🔗 [https://tbo-assemble-production.up.railway.app](https://tbo-assemble-production.up.railway.app)**

---

*Built with ❤️ for VOYAGEHACK 3.0 by TBO.com*
