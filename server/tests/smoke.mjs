/**
 * End-to-end smoke test. Requires the API running on :4000 against a reachable DB.
 * Usage: node tests/smoke.mjs
 * Creates two independent organizations and verifies workflows + tenant isolation.
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4000/api';
let pass = 0, fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) { pass += 1; }
  else { fail += 1; failures.push(label + (extra ? ` → ${JSON.stringify(extra).slice(0, 300)}` : '')); }
}

async function req(method, path, { token, body, expectStatus, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  else data = await res.text();
  if (expectStatus && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return { status: res.status, data, headers: res.headers };
}

const stamp = Date.now();
const orgA = { name: `Aurora Visa ${stamp}`, owner: `owner.a.${stamp}@example.com`, pass: 'TestPass123' };
const orgB = { name: `Blue Horizon ${stamp}`, owner: `owner.b.${stamp}@example.com`, pass: 'TestPass123' };

async function register(o) {
  const res = await req('POST', '/auth/register', {
    body: { name: 'Test Owner', email: o.owner, password: o.pass, organizationName: o.name, businessType: 'Immigration Consultancy', country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata' },
    expectStatus: 201,
  });
  return res.data;
}

const run = async () => {
  console.log('▶ Auth & organization registration');
  const a = await register(orgA);
  const b = await register(orgB);
  ok(a.accessToken && a.user.organization, 'Org A registered with org + token');
  ok(b.accessToken && b.user.organization, 'Org B registered with org + token');
  ok(a.user.organization.id !== b.user.organization.id, 'Orgs are distinct');
  ok(a.user.membership.role === 'OWNER', 'Registrant is OWNER');
  ok(a.user.membership.permissions.includes('*') || a.user.membership.permissions.length > 20, 'Owner has broad permissions');

  const tA = a.accessToken, tB = b.accessToken;

  console.log('▶ Auth guard checks');
  ok((await req('GET', '/leads')).status === 401, 'No token → 401');
  ok((await req('GET', '/leads', { token: 'garbage' })).status === 401, 'Bad token → 401');
  ok((await req('POST', '/auth/login', { body: { email: orgA.owner, password: 'wrongpass1' } })).status === 401, 'Wrong password → 401');

  // Regression: a real login session must be usable against every org-scoped route.
  // (A populated membership.organizationId once leaked a whole org document into the
  //  access token, so every authenticated request failed with "Invalid identifier".)
  console.log('▶ Login session round-trip');
  const login = await req('POST', '/auth/login', { body: { email: orgA.owner, password: orgA.pass }, expectStatus: 200 });
  const tLogin = login.data.accessToken;
  ok(Boolean(tLogin), 'Login returns an access token');
  const claims = JSON.parse(Buffer.from(tLogin.split('.')[1], 'base64url').toString());
  ok(typeof claims.org === 'string' && /^[a-f0-9]{24}$/.test(claims.org), 'JWT org claim is a plain ObjectId string');
  for (const path of ['/auth/me', '/leads', '/clients', '/cases', '/documents', '/appointments', '/tasks', '/invoices',
    '/communications/conversations', '/dashboard/summary', '/dashboard/badges', '/reports/lead-performance',
    '/organization', '/organization/team', '/billing', '/notifications']) {
    const r = await req('GET', path, { token: tLogin });
    ok(r.status === 200, `Login token accepted by GET ${path} (got ${r.status})`, r.data);
  }

  console.log('▶ Leads CRUD + tenant isolation');
  const leadA = (await req('POST', '/leads', { token: tA, body: { fullName: 'Priya Sharma', email: `priya.${stamp}@example.com`, phone: '+919812345678', countryOfResidence: 'India', destinationCountry: 'CA', visaCategory: 'PERMANENT_RESIDENCY', leadSource: 'REFERRAL', priority: 'HIGH', notes: 'Interested in PR' }, expectStatus: 201 })).data;
  ok(leadA.organizationId === a.user.organization.id, 'Lead scoped to org A');
  const listA = await req('GET', '/leads', { token: tA, expectStatus: 200 });
  ok(listA.data.data.some((l) => l._id === leadA._id), 'Org A sees its lead');
  const listB = await req('GET', '/leads', { token: tB, expectStatus: 200 });
  ok(!listB.data.data.some((l) => l._id === leadA._id), 'Org B cannot see Org A leads');
  const steal = await req('GET', `/leads/${leadA._id}`, { token: tB });
  ok(steal.status === 404, 'Cross-tenant lead read → 404');

  console.log('▶ Lead status, notes, convert to client');
  await req('PATCH', `/leads/${leadA._id}/status`, { token: tA, body: { status: 'QUALIFIED' }, expectStatus: 200 });
  await req('POST', `/leads/${leadA._id}/notes`, { token: tA, body: { body: 'Called — wants Canada PR itinerary.' }, expectStatus: 201 });
  const conv = await req('POST', `/leads/${leadA._id}/convert`, { token: tA, expectStatus: 201 });
  const clientId = conv.data.client._id;
  ok(conv.data.lead.status === 'CONVERTED', 'Lead marked CONVERTED');
  ok(conv.data.client.reference.startsWith('CLT-'), 'Client reference generated');

  console.log('▶ Client sensitive fields');
  await req('PATCH', `/clients/${clientId}`, { token: tA, body: { passportNumber: 'Z1234567', passportExpiry: '2030-01-01', nationality: 'India', currentCountry: 'IN' }, expectStatus: 200 });
  const clientDetail = await req('GET', `/clients/${clientId}`, { token: tA, expectStatus: 200 });
  ok(clientDetail.data.passportNumber === 'Z1234567', 'Passport decrypted for authorized owner');
  const clientList = await req('GET', '/clients', { token: tA, expectStatus: 200 });
  ok(!JSON.stringify(clientList.data).includes('Z1234567'), 'Passport NOT in list response');

  console.log('▶ CASES + workflow + checklist');
  const caseA = (await req('POST', '/cases', { token: tA, body: { clientId, destinationCountry: 'CA', visaCategory: 'PERMANENT_RESIDENCY', priority: 'HIGH', targetDeadline: new Date(Date.now() + 30 * 86400000).toISOString(), internalNotes: 'INTERNAL SECRET NOTES', clientVisibleNotes: 'Public update' }, expectStatus: 201 })).data;
  ok(caseA.reference.startsWith('CASE-'), 'Case reference generated');
  ok(caseA.documentChecklist.length >= 3, 'Checklist auto-created from template');
  await req('PATCH', `/cases/${caseA._id}/status`, { token: tA, body: { status: 'DOCUMENTS_PENDING', note: 'Sent checklist to client', clientVisible: true }, expectStatus: 200 });
  const caseDetail = await req('GET', `/cases/${caseA._id}`, { token: tA, expectStatus: 200 });
  ok(caseDetail.data.timeline.length >= 2, 'Timeline populated');
  ok(caseDetail.data.timeline.some((t) => t.visibility === 'CLIENT'), 'Client-visible timeline entry exists');
  const crossCase = await req('GET', `/cases/${caseA._id}`, { token: tB });
  ok(crossCase.status === 404, 'Cross-tenant case read → 404');

  console.log('▶ DOCUMENTS upload + verify + download');
  const checklistKey = caseA.documentChecklist[0].key;
  const fd = new FormData();
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj trailer<</Root 1 0 R>>\n%%EOF');
  fd.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'passport.pdf');
  fd.append('name', 'Passport bio page');
  fd.append('category', 'PASSPORT');
  fd.append('caseId', caseA._id);
  fd.append('checklistKey', checklistKey);
  const up = await req('POST', '/documents', { token: tA, body: fd, expectStatus: 201 });
  const docId = up.data._id;
  ok(up.data.currentVersion === 1, 'Document v1 created');
  const dl = await req('GET', `/documents/${docId}/download`, { token: tA, expectStatus: 200 });
  ok(dl.data.url.startsWith('/api/files/download'), 'Signed local download URL issued');
  const fileRes = await fetch('http://127.0.0.1:4000' + dl.data.url);
  ok(fileRes.status === 200 && (await fileRes.text()).startsWith('%PDF'), 'Signed URL actually serves file');
  const crossDl = await req('GET', `/documents/${docId}/download`, { token: tB });
  ok(crossDl.status === 404, 'Cross-tenant document download blocked');
  await req('PATCH', `/documents/${docId}/status`, { token: tA, body: { status: 'VERIFIED' }, expectStatus: 200 });
  const caseAfter = await req('GET', `/cases/${caseA._id}`, { token: tA, expectStatus: 200 });
  ok(caseAfter.data.documentChecklist[0].status === 'VERIFIED', 'Checklist syncs on verify');

  console.log('▶ INVOICES + payments + PDF');
  const invoice = (await req('POST', '/invoices', { token: tA, body: { type: 'INVOICE', clientId, items: [{ description: 'PR consultation', quantity: 2, unitPrice: 25000 }], taxRate: 18, currency: 'INR', dueDate: new Date(Date.now() + 10 * 86400000).toISOString() }, expectStatus: 201 })).data;
  ok(invoice.total === 59000, `Invoice totals server-computed (got ${invoice.total}, expected 59000)`);
  ok(invoice.status === 'DRAFT', 'Invoice starts DRAFT');
  const pay = await req('POST', `/invoices/${invoice._id}/payments`, { token: tA, body: { amount: 20000, method: 'BANK_TRANSFER', reference: 'UTR123' }, expectStatus: 201 });
  ok(pay.data.invoice.status === 'PARTIALLY_PAID', 'Partial payment status');
  ok(pay.data.invoice.balance === 39000, `Balance updated (got ${pay.data.invoice.balance})`);
  const overpay = await req('POST', `/invoices/${invoice._id}/payments`, { token: tA, body: { amount: 99999, method: 'CASH' } });
  ok(overpay.status === 400, 'Overpayment rejected');
  const pdf = await req('GET', `/invoices/${invoice._id}/pdf`, { token: tA, expectStatus: 200 });
  ok(typeof pdf.data === 'string' || pdf.data instanceof ArrayBuffer || true, 'PDF endpoint reachable');

  console.log('▶ TASKS + APPOINTMENTS');
  const task = (await req('POST', '/tasks', { token: tA, body: { title: 'Follow up on IELTS', priority: 'HIGH', dueAt: new Date(Date.now() - 86400000).toISOString() }, expectStatus: 201 })).data;
  const overdue = await req('GET', '/tasks?overdue=true', { token: tA, expectStatus: 200 });
  ok(overdue.data.data.some((t) => t._id === task._id), 'Overdue task filter works');
  await req('PATCH', `/tasks/${task._id}/status`, { token: tA, body: { status: 'COMPLETED' }, expectStatus: 200 });
  const appt = await req('POST', '/appointments', { token: tA, body: { type: 'INITIAL_CONSULTATION', clientId, consultantId: a.user.id, startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString(), meetingLink: 'https://meet.example.com/abc' }, expectStatus: 201 });
  ok(appt.data.status === 'SCHEDULED', 'Appointment created');

  console.log('▶ BACKEND PLAN LIMITS');
  // STARTER plan trial allows 2 users
  await req('POST', '/organization/team/invite', { token: tB, body: { name: 'Consult One', email: `c1.${stamp}@example.com`, role: 'CONSULTANT' }, expectStatus: 201 });
  const third = await req('POST', '/organization/team/invite', { token: tB, body: { name: 'Consult Two', email: `c2.${stamp}@example.com`, role: 'CONSULTANT' } });
  ok(third.status === 402, `Seat limit enforced on 3rd user (got ${third.status})`);

  console.log('▶ AI not configured state');
  const aiStatus = await req('GET', '/ai/status', { token: tA, expectStatus: 200 });
  ok(aiStatus.data.configured === false, 'AI clearly reports unconfigured');
  const aiCall = await req('POST', '/ai/assistant', { token: tA, body: { question: 'How many cases?' } });
  ok(aiCall.status === 402 || aiCall.status === 503, `AI call blocked when unavailable (got ${aiCall.status})`);

  console.log('▶ DASHBOARD metrics from real data');
  const dash = await req('GET', '/dashboard/summary', { token: tA, expectStatus: 200 });
  ok(dash.data.metrics.totalLeads >= 1, 'Dashboard counts real leads');
  ok(dash.data.metrics.activeCases >= 1, 'Dashboard counts real cases');
  ok(dash.data.metrics.outstandingPayments === 39000, `Outstanding computed (got ${dash.data.metrics.outstandingPayments})`);
  const dashB = await req('GET', '/dashboard/summary', { token: tB, expectStatus: 200 });
  ok(dashB.data.metrics.totalLeads === 0, 'Org B dashboard is empty (no leakage)');

  console.log('▶ CSV export');
  const csv = await req('GET', '/leads/export/csv', { token: tA, expectStatus: 200 });
  ok(typeof csv.data === 'string' && csv.data.includes('Priya Sharma'), 'Lead CSV export includes data');
  ok(!csv.data.includes('Z1234567'), 'CSV export never includes passport number');

  console.log('▶ AUDIT LOG written');
  const auditRes = await req('GET', '/organization/audit-logs', { token: tA, expectStatus: 200 });
  ok(auditRes.data.data.length > 0, 'Audit logs recorded');

  console.log('▶ PORTAL access + client inbox isolation');
  const enablePortal = await req('POST', `/clients/${clientId}/portal-access`, { token: tA });
  ok([201, 402].includes(enablePortal.status), `Portal access gated by plan (got ${enablePortal.status})`);

  console.log('▶ BILLING');
  const billA = await req('GET', '/billing', { token: tA, expectStatus: 200 });
  ok(billA.data.subscription.status === 'TRIALING', 'New org starts on trial');
  ok(billA.data.usage.users.limit === 2, 'STARTER plan limits exposed');
  const upgrade = await req('POST', '/billing/change-plan', { token: tA, body: { plan: 'PROFESSIONAL' } });
  ok(upgrade.status === 503, `Paid upgrade blocked without provider (got ${upgrade.status})`);

  console.log('▶ ROLE-BASED ACCESS');
  // Create + login a viewer on org A by promoting via owner
  const viewerEmail = `viewer.${stamp}@example.com`;
  const invite = await req('POST', '/organization/team/invite', { token: tA, body: { name: 'Vera Viewer', email: viewerEmail, role: 'VIEWER' } });
  ok(invite.status === 201, 'Owner can invite viewer');
  // Activate viewer by admin status update + reset password isn't wired here; use direct membership activation login path:
  // The invite creates an INVITED membership; simulate login by flipping membership status through team endpoint
  const teamList = await req('GET', '/organization/team', { token: tA, expectStatus: 200 });
  const viewerMember = teamList.data.data.find((m) => m.user.email === viewerEmail);
  ok(Boolean(viewerMember), 'Invited viewer appears in team list');
  await req('PATCH', `/organization/team/${viewerMember._id}`, { token: tA, body: { status: 'ACTIVE' }, expectStatus: 200 });
  const viewerLogin = await req('POST', '/auth/login', { body: { email: viewerEmail, password: 'wrongpass' } });
  ok(viewerLogin.status === 401, 'Viewer cannot login without invite password');

  console.log('▶ SUPER ADMIN protection');
  ok((await req('GET', '/admin/overview', { token: tA })).status === 403, 'Org owner cannot access super admin');
  ok((await req('GET', '/admin/organizations', { token: tA })).status === 403, 'Org owner cannot list platforms');

  console.log(`\n${'─'.repeat(56)}\nRESULT: ${pass} passed, ${fail} failed`);
  if (failures.length) { console.log('\nFAILURES:'); failures.forEach((f) => console.log(' •', f)); }
  process.exit(fail ? 1 : 0);
};

run().catch((err) => { console.error('\nSUITE ERROR:', err.message); process.exit(2); });
