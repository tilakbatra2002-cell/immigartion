#!/usr/bin/env node
/**
 * OPTIONAL developer seed — creates one demo organization with a realistic but
 * clearly-labelled dataset so you can explore every screen locally.
 *
 *   node scripts/seed-demo.mjs [--force]
 *
 * Rules respected:
 *  • Nothing is written unless you run this script explicitly.
 *  • The demo org is named "... (Demo)" and its login is printed, never embedded in the UI.
 *  • Idempotent: re-running without --force exits if the demo org already exists.
 *  • Never run against production data.
 */
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import Organization from '../src/models/Organization.js';
import Membership from '../src/models/Membership.js';
import Subscription from '../src/models/Subscription.js';
import User from '../src/models/User.js';
import Lead from '../src/models/Lead.js';
import { Client, FamilyMember } from '../src/models/Client.js';
import ImmigrationCase, { CaseTimeline } from '../src/models/ImmigrationCase.js';
import Document from '../src/models/Document.js';
import Appointment from '../src/models/Appointment.js';
import Task from '../src/models/Task.js';
import Invoice from '../src/models/Invoice.js';
import { Conversation, Message } from '../src/models/Communication.js';
import { hashPassword } from '../src/utils/password.js';

const DEMO_EMAIL = 'demo@immigrationflow.app';
const DEMO_PASS = 'DemoPass123!';
const force = process.argv.includes('--force');

const days = (n) => new Date(Date.now() + n * 86400000);
const pick = (arr, i) => arr[i % arr.length];
const ORG_ID = new mongoose.Types.ObjectId();

await mongoose.connect(env.MONGODB_URI);
try {
  const existing = await Organization.findOne({ slug: 'demo-consultancy' });
  if (existing && !force) {
    console.log('Demo organization already exists. Use --force to wipe and recreate.\n  login:', DEMO_EMAIL, '/', DEMO_PASS);
    process.exit(0);
  }
  if (existing) {
    const orgId = existing._id;
    await User.deleteMany({ email: { $in: [DEMO_EMAIL, 'rohit@northstar.example.com', 'ananya@northstar.example.com', 'kabir@northstar.example.com'] } });
    await Promise.all([
      Lead.deleteMany({ organizationId: orgId }), Client.deleteMany({ organizationId: orgId }),
      ImmigrationCase.deleteMany({ organizationId: orgId }), Document.deleteMany({ organizationId: orgId }),
      Appointment.deleteMany({ organizationId: orgId }), Task.deleteMany({ organizationId: orgId }),
      Invoice.deleteMany({ organizationId: orgId }), CaseTimeline.deleteMany({ organizationId: orgId }),
      Conversation.deleteMany({ organizationId: orgId }), Message.deleteMany({ organizationId: orgId }),
      Membership.deleteMany({ organizationId: orgId }), Subscription.deleteMany({ organizationId: orgId }),
    ]);
    await Organization.deleteOne({ _id: orgId });
    await User.deleteMany({ email: { $in: [DEMO_EMAIL, ...['rohit', 'ananya', 'kabir'].map((n) => `${n}@northstar.example.com`)] } });
    console.log('– previous demo data removed');
  }

  /* ---------- org + owner ---------- */
  const owner = await User.create({
    name: 'Meera Iyer', email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASS),
    role: 'ORG_USER', status: 'ACTIVE', emailVerified: true, emailVerifiedAt: new Date(),
  });
  const org = await Organization.create({
    _id: ORG_ID, name: 'Northstar Migration (Demo)', slug: 'demo-consultancy', businessType: 'Immigration Consultancy',
    email: DEMO_EMAIL, phone: '+91 98100 11223', website: 'https://northstar.example.com',
    createdBy: owner._id, status: 'TRIAL', onboardingCompleted: true,
    settings: { timezone: 'Asia/Kolkata', currency: 'INR', country: 'IN', taxName: 'GST', taxRate: 18, invoicePrefix: 'NS' },
  });
  await Membership.create({ organizationId: org._id, userId: owner._id, role: 'OWNER', status: 'ACTIVE', title: 'Principal Consultant' });
  await Subscription.create({
    organizationId: org._id, plan: 'PROFESSIONAL', status: 'TRIALING', billingCycle: 'MONTHLY', currency: 'INR', provider: 'NONE',
    trialEndsAt: days(11), currentPeriodEnd: days(11),
  });

  const team = [];
  for (const [name, role, title] of [['Rohit Verma', 'CONSULTANT', 'Senior Case Consultant'], ['Ananya Rao', 'CASE_MANAGER', 'Case Manager'], ['Kabir Shah', 'ACCOUNTANT', 'Accounts']]) {
    const u = await User.create({ name, email: `${name.split(' ')[0].toLowerCase()}@northstar.example.com`, passwordHash: await hashPassword(DEMO_PASS), role: 'ORG_USER', status: 'ACTIVE', emailVerified: true });
    await Membership.create({ organizationId: org._id, userId: u._id, role, status: 'ACTIVE', title });
    team.push(u);
  }

  /* ---------- leads ---------- */
  const leadSeeds = [
    ['Neha Kapoor', 'neha.k@example.com', 'AU', 'STUDENT_VISA', 'QUALIFIED', 'WEBSITE', 0],
    ['Sanjay Pillai', 'sanjay.p@example.com', 'CA', 'WORK_VISA', 'CONTACTED', 'REFERRAL', 1],
    ['Ritika Bose', 'ritika.b@example.com', 'GB', 'PERMANENT_RESIDENCY', 'CONSULTATION_BOOKED', 'GOOGLE_ADS', 2],
    ['Aman Sethi', 'aman.s@example.com', 'NZ', 'WORK_VISA', 'NEW', 'WALK_IN', 0],
    ['Divya Menon', 'divya.m@example.com', 'AU', 'FAMILY_SPONSORSHIP', 'NEW', 'SOCIAL_MEDIA', 1],
    ['Farhan Qureshi', 'farhan.q@example.com', 'US', 'VISITOR_VISA', 'LOST', 'PHONE', 2],
  ];
  const leads = [];
  for (let i = 0; i < leadSeeds.length; i += 1) {
    const [fullName, email, dest, visa, status, source, assignee] = leadSeeds[i];
    leads.push(await Lead.create({
      organizationId: org._id, reference: `LED-${2026}${String(1000 + i)}`, fullName, email,
      phone: `+91 9${String(800000000 + i * 11111).slice(0, 9)}`, countryOfResidence: 'IN',
      destinationCountry: dest, visaCategory: visa, status, leadSource: source.toUpperCase(),
      assignedToId: pick(team, assignee)._id, priority: ['HIGH', 'MEDIUM', 'LOW'][i % 3],
      followUpAt: days(i - 2), notes: 'Captured from the public enquiry form.', createdAt: days(-12 + i * 2),
    }));
  }

  /* ---------- clients + cases ---------- */
  const clientSeeds = [
    ['Neha', 'Kapoor', 'AU', 'STUDENT_VISA', 'DOCUMENTS_PENDING', 1],
    ['Ritika', 'Bose', 'GB', 'PERMANENT_RESIDENCY', 'UNDER_REVIEW', 0],
    ['Sanjay', 'Pillai', 'CA', 'WORK_VISA', 'SUBMITTED', 1],
    ['Aman', 'Sethi', 'NZ', 'WORK_VISA', 'INITIAL_ENQUIRY', 2],
  ];
  const clients = [];
  for (let i = 0; i < clientSeeds.length; i += 1) {
    const [firstName, lastName, dest, visa, status, assignee] = clientSeeds[i];
    const client = await Client.create({
      organizationId: org._id, reference: `CLT-${String(1001 + i)}`, firstName, lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`, phone: `+91 9${String(700000000 + i * 33333).slice(0, 9)}`,
      countryOfResidence: 'IN', nationality: 'Indian', dateOfBirth: days(-9000 + i * 400),
      status: 'ACTIVE', assignedConsultantId: pick(team, assignee)._id, createdBy: owner._id,
      addressLine1: `${12 + i} Rose Avenue`, city: ['Mumbai', 'Bengaluru', 'Pune', 'Delhi'][i], state: 'MH', postalCode: '400001', country: 'IN',
    });
    clients.push(client);
    const c = await ImmigrationCase.create({
      organizationId: org._id, reference: `CASE-2026-${String(100 + i)}`, clientId: client._id,
      title: `${visa.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())} — ${dest}`,
      destinationCountry: dest, visaCategory: visa, status, priority: ['HIGH', 'MEDIUM', 'LOW'][i % 3],
      consultantId: pick(team, assignee)._id, createdBy: owner._id,
      applicationDate: days(-30 + i * 3), targetDeadline: days(20 + i * 7),
      fees: { currency: 'INR', agreedAmount: [85000, 145000, 95000, 60000][i], paidAmount: [30000, 0, 95000, 0][i] },
      documentChecklist: [
        { key: 'passport', label: 'Passport bio page', category: 'PASSPORT', required: true, status: i === 0 ? 'VERIFIED' : 'REQUIRED' },
        { key: 'photograph', label: 'Recent photograph', category: 'PHOTOGRAPH', required: true, status: 'VERIFIED' },
        { key: 'ielts', label: 'English test result', category: 'EDUCATIONAL_CERTIFICATES', required: visa === 'STUDENT_VISA', status: i < 2 ? 'UPLOADED' : 'REQUIRED' },
        { key: 'funds', label: 'Proof of funds', category: 'FINANCIAL_DOCUMENTS', required: true, status: i > 1 ? 'REQUIRED' : 'VERIFIED' },
      ],
      internalNotes: 'Fee negotiations handled by Meera. Check sponsor letter before submission.',
      clientVisibleNotes: 'Your application is progressing well. Upload the remaining documents at your earliest convenience.',
    });
    await CaseTimeline.create([
      { organizationId: org._id, caseId: c._id, type: 'CREATED', title: 'Case opened', actorName: 'Meera Iyer', visibility: 'CLIENT', createdAt: days(-30 + i * 3) },
      { organizationId: org._id, caseId: c._id, type: 'STATUS_CHANGE', title: 'Status moved to ' + status.replace(/_/g, ' ').toLowerCase(), actorName: pick(team, assignee).name, visibility: 'CLIENT', createdAt: days(-8) },
      { organizationId: org._id, caseId: c._id, type: 'NOTE', title: 'Internal review note', description: 'Verify the bank statement dates match the sponsor letter.', actorName: 'Rohit Verma', visibility: 'INTERNAL', createdAt: days(-3) },
    ]);
    if (i === 0) {
      await Document.create({
        organizationId: org._id, clientId: client._id, caseId: c._id, name: 'Passport bio page', category: 'PASSPORT', status: 'VERIFIED',
        checklistKey: 'passport', currentVersion: 0, isRequested: false,
      });
      await Document.create({
        organizationId: org._id, clientId: client._id, caseId: c._id, name: 'Bank statement — 6 months', category: 'BANK_STATEMENTS', status: 'REQUIRED',
        checklistKey: 'funds', currentVersion: 0, isRequested: true,
      });
    }
  }

  /* ---------- appointments / tasks ---------- */
  await Appointment.create([
    { organizationId: org._id, clientId: clients[0]._id, caseId: null, title: 'Document review', type: 'DOCUMENT_REVIEW', startAt: days(2), endAt: days(2.02), status: 'SCHEDULED', consultantId: team[0]._id, createdBy: owner._id, timezone: 'Asia/Kolkata', meetingLink: 'https://meet.example.com/northstar-review' },
    { organizationId: org._id, clientId: clients[1]._id, title: 'Consultation follow-up', type: 'FOLLOW_UP', startAt: days(4), endAt: days(4.02), status: 'CONFIRMED', consultantId: team[1]._id, createdBy: owner._id, timezone: 'Asia/Kolkata' },
    { organizationId: org._id, clientId: clients[2]._id, title: 'Submission walkthrough', type: 'CASE_DISCUSSION', startAt: days(-6), endAt: days(-5.98), status: 'COMPLETED', consultantId: team[0]._id, createdBy: owner._id, timezone: 'Asia/Kolkata' },
  ]);
  await Task.create([
    { organizationId: org._id, title: 'Chase IELTS result for Neha Kapoor', status: 'OPEN', priority: 'HIGH', assignedToId: team[1]._id, dueAt: days(-1), relatedType: 'CLIENT', relatedId: clients[0]._id, createdBy: owner._id },
    { organizationId: org._id, title: 'Prepare submission pack for Sanjay Pillai', status: 'IN_PROGRESS', priority: 'MEDIUM', assignedToId: team[0]._id, dueAt: days(3), relatedType: 'CLIENT', relatedId: clients[2]._id, createdBy: owner._id },
    { organizationId: org._id, title: 'Send monthly statements', status: 'OPEN', priority: 'LOW', assignedToId: team[2]._id, dueAt: days(6), createdBy: owner._id, recurrence: 'MONTHLY' },
    { organizationId: org._id, title: 'Archive closed consultation notes', status: 'COMPLETED', priority: 'LOW', assignedToId: owner._id, dueAt: days(-4), completedAt: days(-4), createdBy: owner._id },
  ]);

  /* ---------- invoices ---------- */
  const invoiceRows = await Promise.all([
    { number: 'NS-2026-0001', client: clients[0], items: [{ description: 'Student visa consultation', quantity: 1, unitPrice: 45000 }], status: 'PAID', paid: 53100, issued: days(-25), due: days(-10) },
    { number: 'NS-2026-0002', client: clients[1], items: [{ description: 'PR application — professional fee', quantity: 1, unitPrice: 120000 }, { description: 'Document courier', quantity: 1, unitPrice: 5000 }], status: 'PARTIALLY_PAID', paid: 50000, issued: days(-18), due: days(4) },
    { number: 'NS-2026-0003', client: clients[2], items: [{ description: 'Work visa filing', quantity: 1, unitPrice: 80000 }], status: 'SENT', paid: 0, issued: days(-4), due: days(12) },
  ].map(async (r) => {
    const subtotal = r.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const total = Math.round(subtotal * 1.18);
    return Invoice.create({
      organizationId: org._id, invoiceNumber: r.number, type: 'INVOICE', clientId: r.client._id,
      currency: 'INR', items: r.items.map((it) => ({ ...it, amount: it.quantity * it.unitPrice })),
      subtotal, taxRate: 18, taxAmount: total - subtotal, discountType: 'FIXED', discountValue: 0,
      total, amountPaid: r.paid, balance: total - r.paid, status: r.status,
      issueDate: r.issued, dueDate: r.due, createdBy: owner._id,
      payments: r.paid > 0 ? [{ amount: r.paid, method: r.number.endsWith('1') ? 'BANK_TRANSFER' : 'UPI', paidAt: r.issued, recordedBy: owner._id }] : [],
    });
  }));

  /* ---------- conversations ---------- */
  const conv = await Conversation.create({
    organizationId: org._id, clientId: clients[0]._id, channel: 'PORTAL', subject: 'Documents for your student visa',
    participantEmails: [clients[0].email], lastMessageAt: days(-1), lastMessagePreview: 'Could you confirm the bank statement format?', unreadForStaff: 1,
  });
  await Message.create([
    { organizationId: org._id, conversationId: conv._id, channel: 'PORTAL', direction: 'OUTBOUND', status: 'SENT', body: `Hi ${clients[0].firstName}, we still need your 6-month bank statement and the IELTS result.`, authorName: 'Rohit Verma', from: 'rohit@northstar.example.com', to: clients[0].email, createdAt: days(-2) },
    { organizationId: org._id, conversationId: conv._id, channel: 'PORTAL', direction: 'INBOUND', status: 'RECEIVED', body: 'Could you confirm the bank statement format?', authorName: `${clients[0].firstName} ${clients[0].lastName}`, isClientMessage: true, from: clients[0].email, createdAt: days(-1) },
    { organizationId: org._id, conversationId: conv._id, channel: 'PORTAL', direction: 'INTERNAL', status: 'SENT', body: 'Sponsor letter still pending — do not submit yet.', authorName: 'Meera Iyer', createdAt: days(-1) },
  ]);

  console.log('\n✔ Demo workspace ready');
  console.log('  Organization : Northstar Migration (Demo) — PROFESSIONAL trial, 11 days left');
  console.log('  Login        :', DEMO_EMAIL, '/', DEMO_PASS, '(role OWNER)');
  console.log('  Team logins  : rohit@northstar.example.com · ananya@… · kabir@…  (same password)');
  console.log('  Records      : 6 leads · 4 clients · 4 cases · 3 invoices · 3 appointments · 4 tasks');
  console.log('\n  This data is ONLY created by running this script. Delete the org to remove it.');
} finally {
  await mongoose.disconnect();
}
