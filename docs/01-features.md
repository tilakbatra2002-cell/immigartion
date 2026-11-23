# ImmigrationFlow — Complete Feature List

**Product:** ImmigrationFlow by Webamazee
**Stack:** React 18 + Vite + Tailwind + TanStack Query + Recharts (client) · Node/Express + MongoDB + Mongoose + JWT (server)
**Build verified:** `vite build` passes (`dist/` 2.8 MB, main bundle 323 kB / 99 kB gzip)
**API verified:** `node tests/smoke.mjs` → **71 passed, 0 failed**

---

## 1. Public website
| Page | What it does |
|---|---|
| Landing `/` | Hero, capability grid, AI section with "human in the loop" framing, labelled *illustrative* product preview, dual CTA |
| Features `/features` | Grouped capability matrix per module, comparison against spreadsheet workflows |
| Pricing `/pricing` | Live plan data from `GET /billing/plans`, 6-currency toggle (INR/USD/GBP/AUD/NZD/CAD) |
| Contact `/contact` | Validated form → builds a mailto draft (no fake backend endpoint) |
| Auth pages | Login, Register, Forgot password, Reset password, Verify email, Accept invite |
| Onboarding | 3-step workspace setup (business details, branding, first lead), skippable |
| 404 | Branded not-found page |

## 2. Authentication & tenancy
- Email + password registration that atomically creates **User → Organization (TRIAL) → OWNER Membership → TRIALING Subscription**.
- JWT **access token (15 min, in memory only)** + **rotating refresh token** in `HttpOnly, SameSite=Strict` cookie with reuse detection (`RefreshToken` collection, `replacedByHash`).
- No token is ever written to `localStorage`/`sessionStorage`.
- Password reset, email verification, resend verification, change password.
- Account lockout after 10 failed attempts (15 min). Generic failure messages (no user enumeration).
- Separate **client-portal login** (`POST /auth/client/login`) that only accepts `role: CLIENT` users with an enabled portal profile.
- Every tenant query is scoped by `organizationId` taken from the **authenticated membership**, never from request input. Cross-tenant reads return **404**, not 403, so IDs cannot be probed.

## 3. Roles & permissions
7 staff roles + client portal users:

| Role | Scope |
|---|---|
| **SaaS Super Admin** | Platform-wide (`isSuperAdmin`); bypasses tenant scoping only via `/api/admin/*` |
| **Owner** | Everything incl. billing, roles, workflow, audit |
| **Admin** | Everything except billing ownership changes |
| **Consultant** | Leads, clients, cases, documents, appointments, communications |
| **Case Manager** | Cases, documents, tasks, appointments |
| **Accountant** | Invoices, payments, reports |
| **Viewer** | Read-only |
| **Client (portal)** | Own cases, documents, appointments, invoices, messages only |

- 34 granular permission strings (`leads.update`, `documents.verify`, `payments.record`, `clients.sensitive`, …).
- **Per-organization permission overrides** stored in `Organization.settings.roleOverrides` (`grants`/`revokes`), edited in *Settings → Roles & permissions*.
- Sensitive passport data requires `clients.sensitive` **and** is AES-256-GCM encrypted at rest; never present in list responses.

## 4. Dashboard
- 6 metric cards (total leads, active clients, active cases, awaiting documents, deadlines ≤ 14 days, pending tasks) + 4 secondary (revenue this month, outstanding, lead conversion, upcoming appointments).
- "Needs attention" strip with **live counts that link to pre-filtered lists** (overdue tasks, requested docs, follow-ups due).
- Lead-conversion area chart (6 months), case-status distribution bars, revenue bars — all from real aggregations, empty states when there is no data.
- Upcoming appointments list + activity feed (audit log).
- First-run onboarding block for an empty workspace instead of fake metrics.

## 5. Leads CRM
- Pipeline count cards that act as filters; **table** and **kanban** views (`GET /leads/kanban`).
- Search (name/email/phone), filters (status, source, destination, priority, owner), pagination, CSV export of the current filter.
- Validated create/edit modal (email format, phone, follow-up date in the future), owner assignment from real team members.
- Lead detail: summary, activity, notes add/delete, quick appointment + communication actions.
- **Convert to client** — creates the client record, copies data, marks the lead `CONVERTED` and links `convertedClientId`, then navigates to the new client.

## 6. Clients
- List with search, status filter, destination filter, consultant filter.
- Client form with **passport fields only visible with `clients.sensitive`**.
- Client detail in 6 tabs: Overview, Cases, Documents, Invoices, Family, Appointments.
- Passport number **masked until explicitly revealed**; the reveal itself is audit-logged.
- Family/dependents add & remove.
- Enable portal access (issues a one-time temporary password; shows it in-app **only when SMTP is not configured**) and revoke.
- Invoice PDF download.

## 7. Cases
- Table + **board** view grouped by workflow stage (`GET /cases/board`).
- Filters: status, visa category, destination; client picker with live search.
- Document-checklist **template picker**; otherwise the default template for the visa category is applied automatically.
- Fee agreement + currency.
- Case detail tabs: Overview, Checklist (per-item verify/waive/reject), Timeline (client-visible vs internal), Documents, Tasks, Appointments.
- **Status change modal** requires a completion reason for terminal statuses and lets the consultant choose client visibility. AI **never** sets status, and no status is auto-set to approved/refused.
- AI case brief (`POST /ai/summarize-case`) labelled **"Verify before use"**.
- Document upload straight from the case.

## 8. Documents
- Multipart upload (PDF/JPG/PNG/DOC/DOCX, 15 MB), MIME is **sniffed against the file bytes**, not just the declared type.
- Storage keys are tenant-prefixed; downloads use **short-lived signed URLs** (local disk or S3-compatible).
- Filters: search, status, category, "awaiting upload".
- Expiry column with overdue highlighting.
- Preview modal (PDF iframe / image), verify, reject with reason, delete (soft delete + audit).
- Checklist templates manager (per visa category, default flag, required flags).

## 9. Appointments
- List and **month calendar** view (matrix built from `from`/`to` range).
- Create/edit with timezone-aware start/end validation, meeting link, location, consultant, reminder minutes.
- Status transitions (scheduled → confirmed → completed / cancelled / no-show / rescheduled) with cancellation reason.
- Filters: status, type, consultant.

## 10. Tasks
- Tabs: Open, Overdue, Completed, All; counts from a single aggregate.
- Inline complete toggle, recurrence badge (daily/weekly/monthly + until date).
- Filters: priority, assignee (including **Unassigned**).
- Link a task to a case or client.

## 11. Invoices & payments
- Summary cards (total, paid, balance, count) from a server aggregate.
- Quotation vs Invoice types, line items, discount (fixed/percent), tax rate.
- **All money is computed server-side**; the client never sends totals.
- Record payment modal (amount, method, reference, notes, paid date); **overpayment is rejected by the API**.
- Status machine: draft → sent → partially paid → paid / overdue / cancelled.
- Printable **PDF** for each invoice (`GET /invoices/:id/pdf`).

## 12. Communications
- Three panes: **Conversations** (two-pane chat), **Message history**, **Templates**.
- Channel support: Email (SMTP), WhatsApp Cloud API, Portal.
- **Honest delivery states** — every outbound message shows `SENT` / `FAILED` with the provider error. When an integration is unconfigured the UI says so up front instead of pretending.
- Internal notes are visually distinct and are **excluded from every client-facing query**.
- Template create/delete + variable preview.
- AI "Improve" reply drafting when AI is available.

## 13. Reports (6 tabs)
Lead performance, Case status, Consultant performance, Revenue, Pending documents, Appointments — with date range / rolling-days filter, Recharts visualisations, and **authenticated CSV export**.

## 14. AI Assistant
- Tools: Ask assistant, Case summary, Draft email, Document summary (field extraction), Client reply (reply / improve / translate).
- Gated by **both** plan (`ai: true`) and server key. When unavailable the page explains exactly why and states that manual workflows still work.
- Extractions are explicitly labelled **unverified**; there is no OCR for images (documented limitation).
- Never predicts outcomes, never submits applications, never changes records.
- Usage counters per feature (`GET /ai/usage`).

## 15. Team & workspace settings
- Team list (Active / Invited / All), invite by email with role + title, role change, deactivate/reactivate, last-active timestamps.
- Settings sections: Organization (business details, location, currency, invoicing defaults), My profile, Case workflow (reorder/rename/activate stages), Document templates, Integrations (read-only status of every provider), Roles & permissions, Notifications, Security, **Audit logs** (filterable).

## 16. SaaS subscription
- Current plan, trial countdown, three usage meters (users / active leads / active cases) with warning tones.
- Plan cards with upgrade/downgrade; **limits enforced backend-side** on every create path.
- Cancel at period end / resume; billing history.
- Provider status (Stripe / Razorpay) with an explicit message when no provider is configured — plans then require a platform administrator.

## 17. Client portal
- Separate login + layout, own navigation, unread badge.
- Dashboard: active cases, documents needed, outstanding balance, unread messages, next appointment.
- Cases list + case detail with **progress timeline (client-visible entries only)** and checklist status.
- Documents: upload / replace / download, "action needed" banner.
- Appointments (upcoming / past) with join-meeting link.
- Messages: portal thread, internal notes never returned.
- Invoices with balance + details modal (no fake payment button).
- Profile + password change; passport numbers never displayed.

## 18. Super Admin panel
- Platform overview (organizations, users, active subscriptions, records, MRR estimate, recent signups, plan distribution, live system status).
- Organizations list with status/plan filters → detail with members, usage, subscription; **suspend/reactivate tenant** with a stored reason.
- Users list with role/status filters, disable/enable, **grant super admin** behind a high-risk confirmation.
- Subscriptions, Plans (read-only by design), Platform analytics (signups & cases per month), Platform audit trail, Platform settings (integration status, security posture).

## 19. Cross-cutting quality
- Every list: search + filters + pagination + loading skeleton + empty state + error state with retry.
- Every form: client-side validation with inline field errors **and** server-side zod validation surfacing per-field errors.
- Toast feedback on every mutation; destructive actions use a confirm dialog (some require typing the record name).
- Responsive: verified at 390 px, 834 px and 1440 px with **no horizontal overflow**.
- Keyboard: ⌘K command palette, focus rings, labelled controls, `aria-*` on dialogs/tabs.
