# Data Model & API Reference

All endpoints are prefixed with `/api`. Every tenant route runs `requireAuth → requireOrg`, and every query is scoped by the `organizationId` derived from the authenticated membership.

**155 endpoints across 19 route modules.**

---

## 1. Mongoose models (17 domain + Counter utility)

| Model | Purpose | Key fields |
|---|---|---|
| `Organization` | Tenant root | `name, slug, businessType, email, phone, website, registrationNumber, status(TRIAL/ACTIVE/PAST_DUE/CANCELLED/SUSPENDED), suspendedReason, onboardingCompleted, settings{timezone,currency,locale,city,state,postalCode,country,taxName,taxRate,taxNumber,invoicePrefix,invoiceTerms,notifications,roleOverrides,caseWorkflow}, branding` |
| `User` | Identity (staff **and** portal) | `name, email(unique), phone, passwordHash(select:false), role(SAAS_ADMIN/ORG_USER/CLIENT), isSuperAdmin, emailVerified, status, failedLoginAttempts, lockedUntil, lastLoginAt, timezone` |
| `Membership` | User ↔ Org with a role | `organizationId, userId, role(OWNER…VIEWER), status(ACTIVE/INVITED/DISABLED), title, invitedBy, inviteTokenHash` + unique `(organizationId,userId)` |
| `Subscription` | SaaS plan state | `organizationId, plan(STARTER/PROFESSIONAL/BUSINESS), status(TRIALING/ACTIVE/PAST_DUE/CANCELLED/EXPIRED/PAUSED), billingCycle, currency, provider(NONE/STRIPE/RAZORPAY), cancelAtPeriodEnd, trialEndsAt, currentPeriodEnd, billingHistory[]` |
| `RefreshToken` | Rotating sessions | `userId, organizationId, tokenHash, userAgent, ip, expiresAt, revokedAt, replacedByHash` |
| `Lead` | Pre-client enquiry | `reference, fullName, email, phone, countryOfResidence, destinationCountry, visaCategory, leadSource, assignedToId, priority, status, notes, noteEntries[], followUpAt, lostReason, convertedClientId` |
| `Client` + `FamilyMember` | Converted client & dependents | `reference, firstName, lastName, email, phone, whatsappOptIn, gender, nationality, currentCountry, city, address, preferredDestination, passportNumberEnc (AES-256-GCM), passportExpiry, passportIssuingCountry, assignedConsultantId, source, notes, portalAccess{enabled,userId,invitedAt}, status, convertedFromLeadId` |
| `ImmigrationCase` + `CaseTimeline` | Case file & history | `reference, title, clientId, destinationCountry, visaCategory, consultantId, caseManagerId, applicationDate, targetDeadline, priority, status, statusChangedAt, internalNotes, clientVisibleNotes, documentChecklist[], checklistTemplateId, fees{currency,agreedAmount,paidAmount}, completionReason` · timeline `type, title, description, actorName, visibility(INTERNAL/CLIENT), metadata` |
| `Document` + `DocumentChecklistTemplate` | Files & requirements | `clientId, caseId, checklistKey, category, name, description, status(REQUIRED/UPLOADED/UNDER_REVIEW/VERIFIED/REJECTED/EXPIRED/WAIVED), isRequested, currentVersion, versions[](storageKey,fileName,size,mimeType,uploadedByName), verifiedBy, rejectionReason, comments[], aiSummary, expiryDate, deletedAt` |
| `Appointment` | Consultations | `title, type, clientId, leadId, caseId, consultantId, startAt, endAt, timezone, location, meetingLink, status, notes, reminderMinutes, rescheduleHistory[], cancelReason` |
| `Task` | To-dos | `title, description, assignedToId, createdBy, priority, status(OPEN/IN_PROGRESS/COMPLETED/CANCELLED), dueAt, relatedType, relatedId, recurrence(NONE/DAILY/WEEKLY/MONTHLY), recurrenceUntil, completedAt` |
| `Invoice` + nested `Payment` | Billing | `invoiceNumber, type(INVOICE/QUOTATION), clientId, caseId, issueDate, dueDate, currency, items[]{description,quantity,unitPrice,amount}, subtotal, discountType, discountValue, discount, taxRate, taxAmount, total, amountPaid, balance, status(DRAFT/SENT/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED), notes, terms, payments[]{amount,method,status,reference,paidAt,recordedBy}` |
| `Conversation` / `Message` / `CommunicationTemplate` | Comms | `channel(EMAIL/WHATSAPP/PORTAL), clientId, leadId, subject, lastMessagePreview, unreadForStaff, unreadForClient` · `direction(OUTBOUND/INBOUND/INTERNAL), status(SENT/FAILED/RECEIVED), provider, body, authorName, isClientMessage, error` |
| `Notification` | In-app notifications | `userId, type, title, body, link, readAt` |
| `AuditLog` | Append-only trail | `organizationId, actorId, actorName, actorRole, action, entityType, entityId, description, metadata, ip, userAgent` |
| `AIUsage` | AI metering | `organizationId, userId, feature, provider, promptTokens, completionTokens, totalTokens, status` |
| `Counter` | Atomic reference sequences | `organizationId, key, seq` (drives `CLT-1001`, `CASE-2026-100`, `INV-…`) |
| `Integration` | Reservation for per-org integration config | `organizationId, scope, provider, status, config` |

**Indexes of note:** unique `(organizationId, reference)` on clients/cases/leads, unique `(organizationId, userId)` on memberships, unique `(organizationId, invoiceNumber)`, and compound `(organizationId, createdAt)` on every high-volume collection.

---

## 2. Authentication — `/api/auth`
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Creates org + owner + trial; returns access token + refresh cookie |
| POST | `/auth/login` | Rate-limited; rejects `CLIENT` users (use portal login) |
| POST | `/auth/client/login` | Portal-only |
| POST | `/auth/refresh` | Rotates the refresh token; reuse detection revokes the family |
| POST | `/auth/logout` | Revokes refresh token, clears cookie |
| GET | `/auth/me` | Current user + membership + permissions |
| POST | `/auth/verify-email` · `/auth/resend-verification` | Token-based |
| POST | `/auth/forgot-password` · `/auth/reset-password` | Always 200 on forgot (no enumeration) |
| POST | `/auth/change-password` · PATCH `/auth/profile` | Requires current password |

## 3. Leads — `/api/leads`
`GET /` (page,limit,q,status,priority,source,destinationCountry,assignedToId → `{data,meta,pipeline}`) · `GET /kanban` · `GET /:id` · `POST /` · `PATCH /:id` · `PATCH /:id/status` · `POST /:id/notes` · `DELETE /:id/notes/:noteId` · `POST /:id/convert` · `DELETE /:id` · `GET /export/csv`

## 4. Clients — `/api/clients`
`GET /` · `GET /:id` (includes cases, documents, invoices, family, appointments when permitted) · `POST /` · `PATCH /:id` · `DELETE /:id` · `POST|PATCH|DELETE /:id/family[/:memberId]` · `POST /:id/portal-access` · `DELETE /:id/portal-access`

*Passport fields are encrypted on write, decrypted only for `clients.sensitive` requests, and stripped from list responses.*

## 5. Cases — `/api/cases`
`GET /` · `GET /board` · `GET /:id` · `POST /` · `PATCH /:id` · `PATCH /:id/status` · `POST /:id/timeline` · `PATCH /:id/checklist/:key` · `DELETE /:id`

## 6. Documents — `/api/documents`
`GET /` · `GET /:id` · `POST /` (multipart) · `GET /:id/download` → `{url, previewable, mimeType}` · `PATCH /:id/status` · `POST /:id/comments` · `DELETE /:id` · `POST /request` · `GET /checklists/list` · `POST /checklists` · `PATCH /checklists/:id` · `DELETE /checklists/:id`
Signed file serving: `GET /api/files/download?key=…&token=…` (5-minute JWT).

## 7. Appointments — `/api/appointments`
`GET /` (page,limit,status,type,consultantId,from,to) · `GET /:id` · `POST /` · `PATCH /:id` · `PATCH /:id/status` · `DELETE /:id`

## 8. Tasks — `/api/tasks`
`GET /` (status=OPEN_ALL|COMPLETED, overdue=true, assignedToId incl. `unassigned`, priority → `{data,meta,counts}`) · `POST /` · `PATCH /:id` · `PATCH /:id/status` · `DELETE /:id`

## 9. Invoices — `/api/invoices`
`GET /` → `{data,meta,summary{total,paid,balance,count}}` · `GET /:id` (items + payments) · `POST /` · `PATCH /:id` · `PATCH /:id/status` · `POST /:id/payments` · `DELETE /:id/payments/:paymentId` · `DELETE /:id` · `GET /:id/pdf`

## 10. Communications — `/api/communications`
`GET /conversations` · `POST /conversations` · `GET /conversations/:id` · `POST /conversations/:id/messages` → `{delivered, error}` · `POST /conversations/:id/notes` · `GET /messages` · `GET /templates` · `POST /templates` · `PATCH /templates/:id` · `DELETE /templates/:id` · `POST /templates/:id/preview` · `GET /integrations/status`

## 11. AI — `/api/ai`
`GET /status` · `POST /summarize-document` · `POST /documents/:id/verify-fields` · `POST /draft-email` · `POST /summarize-case` · `POST /client-reply` · `POST /assistant` · `GET /usage`
Every response carries a `disclaimer`; blocked calls return **402** (plan) or **503** (provider) with a reason.

## 12. Dashboard — `/api/dashboard`
`GET /summary` (metrics, charts, lists) · `GET /badges` (sidebar counters)

## 13. Reports — `/api/reports`
`GET /lead-performance` · `GET /case-status` · `GET /consultant-performance` · `GET /revenue` · `GET /pending-documents` · `GET /appointments` · `POST /export-csv`

## 14. Organization — `/api/organization`
`GET /` · `PATCH /` · `GET|PUT /workflow` · `GET /team` · `POST /team/invite` · `PATCH /team/:id` · `DELETE /team/:id` · `GET /roles` · `PUT /roles/:role` · `GET /audit-logs` · `GET /usage` · `GET /integrations` · `GET /constants`

## 15. Billing — `/api/billing`
`GET /plans` · `GET /` (plan, usage meters, history) · `POST /change-plan` · `POST /cancel` · `POST /resume` · `POST /checkout` · `GET /invoices`

## 16. Portal — `/api/portal` (CLIENT role only)
`GET /me` · `GET /dashboard` · `GET /cases` · `GET /cases/:id` · `GET /documents` · `GET /documents/:id/download` · `POST /documents` · `GET /appointments` · `GET /invoices` · `GET /messages` · `POST /messages` · `GET /family`
*Internal notes, fees, `internalNotes` and non-CLIENT timeline entries are excluded at the query level.*

## 17. Admin — `/api/admin` (super admin only)
`GET /overview` · `GET /analytics` · `GET /organizations` · `GET /organizations/:id` · `PATCH /organizations/:id` · `PATCH /subscriptions/:organizationId` · `GET /users` · `PATCH /users/:id` · `GET /plans` · `GET /audit-logs` · `GET /revenue` · `GET /system` · `POST /users/:id/grant-superadmin`

## 18. Webhooks — `/api/webhooks`
`POST /stripe` · `POST /razorpay` — raw-body HMAC signature verification, idempotent event handling, mounted **before** `express.json()`.

## 19. Notifications — `/api/notifications`
`GET /` · `PATCH /:id/read` · `POST /read-all`

---

## Response conventions
- Lists: `{ data: [...], meta: { total, page, limit, pages, hasNext, hasPrev } }`
- Validation failure: `400` `{ error, code: 'VALIDATION_ERROR', details: { field: message } }`
- Auth: `401` · Permission: `403` · Missing/foreign record: `404` · Plan limit: `402` with `{ details: { limit, allowed, current } }` · Conflict: `409` · Integration unavailable: `503`
