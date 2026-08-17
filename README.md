# Vehicle Rental Management Backend

REST API for a vehicle rental company. Staff log in with a JWT and manage the vehicle fleet;
customer bookings are recorded as rentals. **A vehicle can never be booked twice for
overlapping dates**, and a monthly report attributes rental days and revenue to the correct
calendar month.

Built for the M360ICT LTD backend developer technical assessment.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [npm scripts](#npm-scripts)
- [Seeded data](#seeded-data)
- [API reference](#api-reference)
- [How the overlap check works](#how-the-overlap-check-works) ← *the part to read*
- [How the monthly report works](#how-the-monthly-report-works) ← *the other part to read*
- [Design decisions](#design-decisions)
- [Project structure](#project-structure)

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 20+ / TypeScript 5.7 (`strict: true`) |
| Web framework | Express 4 |
| Query builder | Knex 3 over `pg` 8, with a connection pool |
| Database | PostgreSQL 14+ |
| Validation | Joi 17 |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Uploads | Multer 2, local disk storage |
| Tooling | ESLint 9 (flat config) + Prettier 3 |
| Hardening | helmet, cors, express-rate-limit |

The code is organised in layers — **Controller → Service → Repository** — each a class, wired
by constructor injection in the module's `*.routes.ts`. Route handlers are one-liners; no
business logic lives in an Express callback.

---

## Quick start

### 1. Prerequisites

- Node.js 20 or newer
- PostgreSQL 14 or newer, running locally

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Then edit `.env` and set at minimum `DB_USER`, `DB_PASSWORD` and `JWT_SECRET`.
`JWT_SECRET` must be **at least 32 characters** — the app refuses to boot otherwise.
Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Create the database

```bash
createdb -U postgres vehicle_rental
```

Or from inside `psql`:

```bash
psql -U postgres -c "CREATE DATABASE vehicle_rental"
```

### 5. Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

The migrations build cleanly on a completely empty database — there is nothing to apply by
hand. `npm run db:reset` rolls everything back and rebuilds from scratch.

### 6. Run

```bash
npm run dev
```

The API listens on `http://localhost:3000`. Check it with:

```bash
curl http://localhost:3000/health
```

For a production build:

```bash
npm run build
npm start
```

---

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm run db:migrate` | Apply all migrations |
| `npm run db:rollback` | Roll every migration back |
| `npm run db:seed` | Truncate and re-seed |
| `npm run db:reset` | rollback → migrate → seed |

---

## Seeded data

**Staff login** (both accounts use the same password):

| Email | Password |
| --- | --- |
| `admin@rental.test` | `Password123!` |
| `ops@rental.test` | `Password123!` |

**Vehicles** — ids 1–6: Toyota Corolla Altis (sedan, 4500/day), Honda CR-V (suv, 7200),
Toyota Hiace (van, 9500), Suzuki Swift (hatchback, 3200), Mitsubishi Pajero Sport (suv,
11000), Nissan X-Trail (suv, 8000).

**Rentals** — nine fixtures, deliberately chosen so the report is provable:

| id | vehicle | dates | days | total | status | why it exists |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | 2025-07-29 → 2025-08-03 | 6 | 27,000 | completed | **crosses the July/August boundary** |
| 2, 3 | 2 | Aug 5–9, Aug 20–22 | 5, 3 | 36,000, 21,600 | completed | two bookings on one vehicle |
| 4 | 3 | 2025-08-10 → 2025-08-14 | 5 | 47,500 | completed | |
| 5 | 4 | 2025-08-15 → 2025-08-15 | 1 | 3,200 | completed | same start/end date = exactly 1 day |
| 6 | 5 | 2025-08-25 → 2025-09-02 | 9 | 99,000 | ongoing | crosses the August/September boundary |
| 7 | 1 | 2025-08-01 → 2025-08-03 | 3 | 13,500 | **cancelled** | overlaps rental 1 on purpose — proves cancelled rentals neither block nor count |
| 8 | 6 | 2025-09-10 → 2025-09-12 | 3 | 24,000 | booked | future booking |
| 9 | 1 | 2025-07-10 → 2025-07-14 | 5 | 22,500 | completed | July-only, no overlap with rental 1 |

---

## API reference

Base URL: `http://localhost:3000`

Every response uses the same envelope:

```jsonc
// success
{ "success": true, "message": "…", "data": { } }
// failure
{ "success": false, "message": "…", "code": "CONFLICT", "errors": [], "details": {} }
```

All `/vehicles`, `/rentals` and `/reports` routes require `Authorization: Bearer <token>`.

### Auth

#### `POST /auth/login`

Rate limited to 5 failed attempts per IP per 15 minutes.

```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@rental.test","password":"Password123!"}'
```

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOi…",
    "token_type": "Bearer",
    "expires_in": "1d",
    "staff": { "id": 1, "email": "admin@rental.test", "name": "Ayesha Rahman" }
  }
}
```

Save it for the calls below:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"admin@rental.test","password":"Password123!"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.token")
```

### Vehicles

#### `GET /vehicles`

Query params: `page` (default 1), `limit` (default 10, max 100), `category`, `search`
(case-insensitive match on name).

```bash
curl "http://localhost:3000/vehicles?page=1&limit=5&category=suv&search=cr" -H "Authorization: Bearer $TOKEN"
```

#### `GET /vehicles/:id`

```bash
curl http://localhost:3000/vehicles/1 -H "Authorization: Bearer $TOKEN"
```

#### `POST /vehicles` — multipart/form-data

```bash
curl -X POST http://localhost:3000/vehicles -H "Authorization: Bearer $TOKEN" -F "name=Toyota Premio" -F "plate_number=DHA-KA-9999" -F "category=sedan" -F "daily_rate=5200" -F "photo=@./car.jpg"
```

`photo` is optional; JPEG, PNG and WebP up to 5 MB are accepted. The stored file is served
at `GET /uploads/<filename>`, and the response includes both `photo_path` and a ready-to-use
`photo_url`. A duplicate `plate_number` returns **409**.

#### `PUT /vehicles/:id` — multipart/form-data

Send any subset of the fields. Attaching a new `photo` replaces the old one and deletes the
previous file; `remove_photo=true` clears it without a replacement.

```bash
curl -X PUT http://localhost:3000/vehicles/1 -H "Authorization: Bearer $TOKEN" -F "daily_rate=4800" -F "photo=@./new-car.jpg"
```

#### `DELETE /vehicles/:id` — soft delete

Sets `deleted_at`. The vehicle disappears from all read paths and can no longer be booked,
but its rental history is preserved.

### Rentals

#### `GET /rentals`

Query params: `page`, `limit`, `vehicle_id`, `status`, `start_date`, `end_date`, `search`
(customer name or phone).

The date filter matches rentals that **overlap** the window, not only those fully inside it —
the same intersection rule used by the booking check. Either bound may be omitted.

```bash
curl "http://localhost:3000/rentals?vehicle_id=1&status=completed&start_date=2025-08-01&end_date=2025-08-31" -H "Authorization: Bearer $TOKEN"
```

#### `POST /rentals`

```bash
curl -X POST http://localhost:3000/rentals -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"vehicle_id":3,"customer_name":"Arif Chowdhury","customer_phone":"+8801711223344","start_date":"2025-10-10","end_date":"2025-10-12"}'
```

`total_amount` is **never accepted from the client** — it is computed server-side as
`daily_rate × inclusive day count` (2025-10-10 → 2025-10-12 is 3 days; same start and end
date is 1 day).

Booking the same vehicle over overlapping dates returns **409** with the offending rental
attached:

```json
{
  "success": false,
  "code": "CONFLICT",
  "message": "Vehicle 3 already has a booked rental from 2025-10-10 to 2025-10-12, which overlaps 2025-10-11 to 2025-10-14.",
  "details": {
    "conflicting_rental": {
      "id": 10,
      "start_date": "2025-10-10",
      "end_date": "2025-10-12",
      "status": "booked",
      "customer_name": "Arif Chowdhury"
    },
    "requested": { "vehicle_id": 3, "start_date": "2025-10-11", "end_date": "2025-10-14" }
  }
}
```

#### `PUT /rentals/:id`

Any change to `vehicle_id`, `start_date` or `end_date` re-runs the overlap check (excluding
this rental, so it never conflicts with itself) and recomputes `total_amount`.

```bash
curl -X PUT http://localhost:3000/rentals/10 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"end_date":"2025-10-15","status":"ongoing"}'
```

#### `DELETE /rentals/:id`

Hard delete.

### Reports

#### `GET /reports/rentals?month=YYYY-MM[&vehicle_id=]`

```bash
curl "http://localhost:3000/reports/rentals?month=2025-08" -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "success": true,
  "message": "Rental report for 2025-08 generated successfully.",
  "data": {
    "month": "2025-08",
    "period": { "start_date": "2025-08-01", "end_date": "2025-08-31", "days_in_month": 31 },
    "vehicles": [
      { "id": 5, "name": "Mitsubishi Pajero Sport", "total_bookings": 1, "days_rented": 7, "revenue": 77000.00 },
      { "id": 2, "name": "Honda CR-V",              "total_bookings": 2, "days_rented": 8, "revenue": 57600.00 },
      { "id": 3, "name": "Toyota Hiace",            "total_bookings": 1, "days_rented": 5, "revenue": 47500.00 },
      { "id": 1, "name": "Toyota Corolla Altis",    "total_bookings": 1, "days_rented": 3, "revenue": 13500.00 },
      { "id": 4, "name": "Suzuki Swift",            "total_bookings": 1, "days_rented": 1, "revenue":  3200.00 },
      { "id": 6, "name": "Nissan X-Trail",          "total_bookings": 0, "days_rented": 0, "revenue":     0.00 }
    ],
    "totals": { "total_bookings": 6, "days_rented": 24, "revenue": 198800.00 },
    "top_vehicle_by_revenue": { "id": 5, "name": "Mitsubishi Pajero Sport", "revenue": 77000.00 }
  }
}
```

Note vehicle 1: the Jul 29 → Aug 3 rental is 6 days and 27,000 in total, but August only sees
**3 days and 13,500**. Ask for July and you get the other half:

```bash
curl "http://localhost:3000/reports/rentals?month=2025-07" -H "Authorization: Bearer $TOKEN"
```

→ vehicle 1: `total_bookings: 2, days_rented: 8, revenue: 36000` (3 days / 13,500 from the
boundary rental plus 5 days / 22,500 from the July-only one). 13,500 + 13,500 = 27,000 —
the slices reconcile exactly.

---

## How the overlap check works

> `src/modules/rentals/rental.repository.ts` → `findOverlapping()`
> `src/modules/rentals/rental.service.ts` → `create()` / `update()` / `assertNoOverlap()`

### The predicate

Two closed date ranges `[s1, e1]` and `[s2, e2]` intersect **if and only if**:

```
s1 <= e2   AND   e1 >= s2
```

The easiest way to be sure is to look at the complement. Two ranges *miss* each other exactly
when one finishes strictly before the other starts:

```
e1 < s2   OR   e2 < s1
```

Negate that (De Morgan) and you get `e1 >= s2 AND e2 >= s1` — the same condition. There is no
need for the four-way `OR` of containment cases people often write; every arrangement
(candidate inside the existing rental, straddling either edge, or swallowing it whole) is
already covered by these two comparisons.

The comparisons are **inclusive** because a rental occupies both of its endpoint days. A
booking that ends on Sep 12 does conflict with one that starts on Sep 12 — the car cannot be
in two places that day. That is also why the day count is `end - start + 1`.

### The SQL

```sql
SELECT r.id, r.start_date, r.end_date, r.status, r.customer_name
FROM rentals r
WHERE r.vehicle_id = ?
  AND r.status = ANY(?::text[])          -- BLOCKING_RENTAL_STATUSES
  AND (?::int IS NULL OR r.id <> ?::int) -- self-exclusion on PUT
  AND r.start_date <= ?::date            -- existing.start <= candidate.end
  AND r.end_date   >= ?::date            -- existing.end   >= candidate.start
ORDER BY r.start_date
LIMIT 1;
```

It rides the composite index `rentals (vehicle_id, start_date, end_date)`.

### Which statuses block

`BLOCKING_RENTAL_STATUSES = ['booked', 'ongoing', 'completed']` — **everything except
`cancelled`**.

The spec says two rentals conflict only if "both are active" without defining active. This is
the deliberate reading: a `completed` rental means the vehicle was physically out on those
dates, so a new booking must not be allowed to overlap it after the fact. Cancelling is the
one action that hands the dates back. The list is defined once in `rental.types.ts` and bound
into the SQL, so the overlap check and the report can never disagree about it.

### Why it is race-proof

The check and the insert run in one transaction, in this order:

1. `SELECT … FROM vehicles WHERE id = ? AND deleted_at IS NULL FOR UPDATE`
2. the overlap probe above
3. `INSERT INTO rentals …`

**Step 1 is what makes step 2 trustworthy.** The obvious instinct is to put `FOR UPDATE` on
the overlap query itself — but that locks nothing when the probe returns no rows, because
there is no row to lock. Two simultaneous requests would both see "free" and both insert, and
the vehicle ends up double-booked.

Locking the **vehicle** row instead gives the two transactions something concrete to contend
on. The row always exists, so the second transaction blocks at step 1 until the first commits,
then re-reads and sees the rental that was just written. This is the spec's bonus item
("two people booking the same vehicle at the same moment can't both succeed"), done at the
only point where it actually holds.

You can watch it happen with two `psql` sessions:

```sql
-- session A
BEGIN;
SELECT id FROM vehicles WHERE id = 1 FOR UPDATE;   -- acquires the lock

-- session B
BEGIN;
SELECT id FROM vehicles WHERE id = 1 FOR UPDATE;   -- blocks here until A commits
```

`update()` does the same thing, passing `excludeRentalId` so a rental never conflicts with
itself, and re-checking when a cancelled rental is revived — its dates are becoming occupied
again.

### Why not a database constraint

Postgres can enforce this natively:

```sql
CREATE EXTENSION btree_gist;
ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status <> 'cancelled');
```

That is genuinely stronger — no application path can bypass it. It is **deliberately not
used here** because the assessment states the check belongs in application code, and because
it costs a good error message: the client would get a bare constraint violation instead of
the 409 body naming the conflicting rental. In production I would use both: the constraint as
the backstop, the application check for the message. The commented-out DDL is in
`20250817120003_create_rentals.ts` for reference.

---

## How the monthly report works

> `src/modules/reports/report.repository.ts` → `getMonthlyReport()`

The rule from the spec: *a rental running July 29 – Aug 3 contributes **3** days to the
August report, not 6.* That is a range intersection, and it is expressed by clamping each
rental to the month's bounds:

```
days_in_month = LEAST(end_date, month_end) - GREATEST(start_date, month_start) + 1
```

`GREATEST` pushes the start forward to the first of the month if the rental began earlier;
`LEAST` pulls the end back to the last of the month if it runs on. For Jul 29 → Aug 3 against
August:

```
LEAST('2025-08-03', '2025-08-31')   =  2025-08-03
GREATEST('2025-07-29', '2025-08-01') =  2025-08-01
2025-08-03 - 2025-08-01 + 1          =  3   ✓
```

The `+ 1` is the same inclusivity used everywhere else, so a single-day rental counts as 1.

### The query

```sql
WITH bounds AS (
    SELECT make_date(?::int, ?::int, 1)                                  AS month_start,
           (make_date(?::int, ?::int, 1) + INTERVAL '1 month')::date - 1 AS month_end
),
overlapping AS (
    SELECT r.id, r.vehicle_id, r.total_amount,
           (r.end_date - r.start_date) + 1                              AS total_days,
           (LEAST(r.end_date, b.month_end)
              - GREATEST(r.start_date, b.month_start)) + 1              AS days_in_month
    FROM rentals r
    CROSS JOIN bounds b
    WHERE r.status = ANY(?::text[])
      AND r.start_date <= b.month_end     -- the same intersection predicate
      AND r.end_date   >= b.month_start   -- as the booking check, vs the month
)
SELECT v.id, v.name, v.plate_number, v.category,
       COUNT(o.id)::int                        AS total_bookings,
       COALESCE(SUM(o.days_in_month), 0)::int  AS days_rented,
       COALESCE(SUM(ROUND(o.total_amount * o.days_in_month / o.total_days, 2)), 0) AS revenue
FROM vehicles v
LEFT JOIN overlapping o ON o.vehicle_id = v.id
WHERE v.deleted_at IS NULL
  AND (?::int IS NULL OR v.id = ?::int)
GROUP BY v.id, v.name, v.plate_number, v.category
ORDER BY revenue DESC, v.id ASC;
```

`month_end` is computed as *first of next month minus one day*, so February, leap years and
31-day months all fall out correctly with no special cases.

### Three decisions worth defending

**1. Revenue is prorated from `total_amount`, not recomputed from `daily_rate`.**

```
revenue_slice = total_amount × days_in_month / total_days
```

`total_amount` is the price actually agreed when the rental was created. Recomputing as
`daily_rate × days_in_month` would silently rewrite history the moment someone edits a
vehicle's rate — last month's report would change. Prorating also guarantees that a rental's
monthly slices sum back to exactly what the customer was charged: the seeded boundary rental
contributes 13,500 to July and 13,500 to August, and 13,500 + 13,500 = 27,000 = its
`total_amount`.

**2. `LEFT JOIN` from `vehicles`, so idle vehicles appear with zeros.** The report then reads
as fleet utilisation — a vehicle that earned nothing all month is exactly the row a manager
wants to see — and `?vehicle_id=` always returns a row instead of an empty list.

**3. Cancelled rentals are excluded**, via the same `BLOCKING_RENTAL_STATUSES` constant the
overlap check binds. The seeded cancelled rental (id 7) overlaps a live one on the same
vehicle and appears in neither month's figures.

`top_vehicle_by_revenue` is the first row of the already-sorted result, returned as `null`
when every vehicle earned zero — naming an arbitrary vehicle in an empty month would be
misleading.

---

## Design decisions

**Dates never become JavaScript `Date` objects.** `pg` normally converts a `DATE` column to a
`Date` at *local* midnight, so in UTC+6 the value `2025-08-01` serialises back to
`2025-07-31T18:00:00Z` — a silently wrong day. `src/database/connection.ts` overrides the
parser to keep date-only columns as `'YYYY-MM-DD'` strings, and all day arithmetic
(`src/core/dates.ts`) goes through `Date.UTC`. Joi validates dates as strings for the same
reason. This is the single most important detail for making the overlap and report queries
trustworthy.

**`NUMERIC` and `INT8` are parsed to numbers** so `daily_rate`, `total_amount` and
`COUNT(*)` arrive as numbers rather than strings, and the JSON contract stays numeric.

**Raw SQL where SQL is clearer.** The overlap probe, the report, and both paginated listings
are hand-written SQL rather than Knex chains. The listings use `COUNT(*) OVER ()` so the
unpaginated total comes back on the same scan as the page — one round trip instead of the
usual query-plus-count-query. All bindings are positional (`?`); named bindings collide with
Postgres's `::type` cast syntax.

**`updated_at` is maintained by a trigger**, not by hand in each service, so no write path can
forget it.

**Soft delete is one-directional.** `deleted_at` hides a vehicle from every read path and from
new bookings (the row-lock query filters `deleted_at IS NULL`), while the FK from `rentals`
is `ON DELETE RESTRICT` so history can never be orphaned. `plate_number` keeps a plain unique
constraint, so a soft-deleted vehicle's plate stays reserved — if plates should be reusable
after deletion, that becomes a partial unique index `WHERE deleted_at IS NULL`.

**Uploads are named from the mime type**, never from the client-supplied filename, which
removes path-traversal and double-extension tricks. Orphaned files are cleaned up when a
request fails after Multer has already written to disk, and a replaced photo is unlinked only
*after* the row update commits.

**Login does not leak which emails exist.** An unknown email is still compared against a dummy
bcrypt hash so the response time matches, and both failure modes return the same message.

**Validation coerces and strips.** `stripUnknown` means a client cannot inject
`total_amount` into a rental body — it is dropped before the service ever sees it.

---

## Project structure

```
src/
├── app.ts                    Express assembly, static /uploads, 404 + error handler
├── server.ts                 Bootstrap, DB health check, graceful shutdown
├── config/env.ts             Joi-validated, fully typed environment
├── core/
│   ├── ApiError.ts           HttpError hierarchy (400/401/403/404/409/413/422/429)
│   ├── asyncHandler.ts       Promise-rejection bridge for Express 4
│   ├── BaseRepository.ts     Shared table access + transaction helper
│   ├── dates.ts              Inclusive day counts, UTC-only
│   └── http.ts               Response envelope + pagination types
├── database/
│   ├── connection.ts         Knex pool + pg type parsers
│   ├── migrations/           staff → vehicles → rentals
│   └── seeds/                staff → vehicles → rentals
├── middlewares/              auth, validate, upload, error, notFound, rateLimit
├── modules/
│   ├── auth/                 login + JWT issuing
│   ├── vehicles/             CRUD, photo upload, soft delete
│   ├── rentals/              CRUD + the overlap check
│   └── reports/              the monthly report
├── routes/index.ts           Mounts /auth /vehicles /rentals /reports
└── types/express.d.ts        Request.staff — the decoded JWT payload
```

Each module holds `*.types.ts`, `*.validation.ts`, `*.repository.ts`, `*.service.ts`,
`*.controller.ts` and `*.routes.ts`.

A Postman collection is in [`docs/postman_collection.json`](docs/postman_collection.json) —
the login request captures the JWT into a collection variable automatically, so every other
request is authenticated with no copy-pasting.
