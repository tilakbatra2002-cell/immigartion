export const COUNTRIES = [
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', currency: 'NZD' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD' },
];
export const RESIDENCE_COUNTRIES = [
  ...COUNTRIES,
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SG', name: 'Singapore' }, { code: 'DE', name: 'Germany' },
  { code: 'IE', name: 'Ireland' }, { code: 'PH', name: 'Philippines' }, { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' }, { code: 'PK', name: 'Pakistan' }, { code: 'BD', name: 'Bangladesh' },
  { code: 'NP', name: 'Nepal' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'OTHER', name: 'Other' },
];
export const VISA_CATEGORIES = [
  { key: 'STUDENT_VISA', label: 'Student Visa', short: 'Student' },
  { key: 'WORK_VISA', label: 'Work Visa', short: 'Work' },
  { key: 'VISITOR_VISA', label: 'Visitor Visa', short: 'Visitor' },
  { key: 'PERMANENT_RESIDENCY', label: 'Permanent Residency', short: 'PR' },
  { key: 'SKILLED_MIGRATION', label: 'Skilled Migration', short: 'Skilled' },
  { key: 'FAMILY_SPONSORSHIP', label: 'Family Sponsorship', short: 'Family' },
  { key: 'BUSINESS_IMMIGRATION', label: 'Business Immigration', short: 'Business' },
  { key: 'CITIZENSHIP', label: 'Citizenship', short: 'Citizenship' },
  { key: 'OTHER', label: 'Other', short: 'Other' },
];
export const LEAD_STATUSES = [
  { key: 'NEW', label: 'New', color: 'sky' },
  { key: 'CONTACTED', label: 'Contacted', color: 'blue' },
  { key: 'CONSULTATION_BOOKED', label: 'Consultation Booked', color: 'indigo' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'violet' },
  { key: 'CONVERTED', label: 'Converted', color: 'green' },
  { key: 'LOST', label: 'Lost', color: 'red' },
];
export const LEAD_SOURCES = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'GOOGLE_ADS', 'EVENT', 'PARTNER', 'PHONE', 'EMAIL', 'OTHER'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const CASE_STATUSES = [
  { key: 'INITIAL_ENQUIRY', label: 'Initial Enquiry', color: 'slate' },
  { key: 'CONSULTATION', label: 'Consultation', color: 'sky' },
  { key: 'DOCUMENTS_PENDING', label: 'Documents Pending', color: 'amber' },
  { key: 'DOCUMENTS_RECEIVED', label: 'Documents Received', color: 'blue' },
  { key: 'UNDER_REVIEW', label: 'Under Review', color: 'indigo' },
  { key: 'READY_FOR_SUBMISSION', label: 'Ready for Submission', color: 'violet' },
  { key: 'SUBMITTED', label: 'Submitted', color: 'cyan' },
  { key: 'ADDITIONAL_INFO_REQUESTED', label: 'Additional Info Requested', color: 'orange' },
  { key: 'DECISION_RECEIVED', label: 'Decision Received', color: 'purple' },
  { key: 'APPROVED', label: 'Approved', color: 'green' },
  { key: 'REFUSED', label: 'Refused', color: 'red' },
  { key: 'WITHDRAWN', label: 'Withdrawn', color: 'stone' },
  { key: 'CLOSED', label: 'Closed', color: 'gray' },
];
export const DOC_CATEGORIES = [
  { key: 'PASSPORT', label: 'Passport' }, { key: 'PHOTOGRAPH', label: 'Photograph' },
  { key: 'EDUCATIONAL_CERTIFICATES', label: 'Educational Certificates' },
  { key: 'EMPLOYMENT_RECORDS', label: 'Employment Records' },
  { key: 'FINANCIAL_DOCUMENTS', label: 'Financial Documents' },
  { key: 'BANK_STATEMENTS', label: 'Bank Statements' },
  { key: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
  { key: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { key: 'MEDICAL_DOCUMENTS', label: 'Medical Documents' },
  { key: 'POLICE_CLEARANCE', label: 'Police Clearance' },
  { key: 'VISA_FORMS', label: 'Visa Forms' }, { key: 'OTHER', label: 'Other' },
];
export const DOC_STATUSES = [
  { key: 'REQUIRED', label: 'Required', tone: 'warning' },
  { key: 'UPLOADED', label: 'Uploaded', tone: 'info' },
  { key: 'UNDER_REVIEW', label: 'Under Review', tone: 'info' },
  { key: 'VERIFIED', label: 'Verified', tone: 'success' },
  { key: 'REJECTED', label: 'Rejected', tone: 'danger' },
  { key: 'EXPIRED', label: 'Expired', tone: 'danger' },
  { key: 'WAIVED', label: 'Waived', tone: 'muted' },
];
export const APPOINTMENT_TYPES = [
  { key: 'INITIAL_CONSULTATION', label: 'Initial Consultation' },
  { key: 'DOCUMENT_REVIEW', label: 'Document Review' },
  { key: 'FOLLOW_UP', label: 'Follow-up' },
  { key: 'CASE_DISCUSSION', label: 'Case Discussion' },
  { key: 'GENERAL_CONSULTATION', label: 'General Consultation' },
];
export const APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const TASK_RECURRENCE = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];
export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
export const PAYMENT_METHODS = [
  { key: 'BANK_TRANSFER', label: 'Bank Transfer' }, { key: 'CASH', label: 'Cash' }, { key: 'UPI', label: 'UPI' },
  { key: 'CARD', label: 'Card' }, { key: 'CHEQUE', label: 'Cheque' }, { key: 'STRIPE', label: 'Stripe' },
  { key: 'RAZORPAY', label: 'Razorpay' }, { key: 'OTHER', label: 'Other' },
];
export const ORG_BUSINESS_TYPES = ['Immigration Consultancy', 'Visa Agency', 'Overseas Education Consultancy', 'Immigration Law Firm', 'Other'];
export const ORG_TIMEZONES = ['Asia/Kolkata', 'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'Europe/London', 'America/Toronto', 'America/Vancouver', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore'];
export const TEMPLATE_CATEGORIES = [
  { key: 'GENERAL', label: 'General' }, { key: 'DOCUMENT_REMINDER', label: 'Document Reminder' },
  { key: 'FOLLOW_UP', label: 'Follow-up' }, { key: 'INVOICE', label: 'Invoice' },
  { key: 'APPOINTMENT', label: 'Appointment' }, { key: 'WELCOME', label: 'Welcome' }, { key: 'CASE_UPDATE', label: 'Case Update' },
];

export const MESSAGE_CHANNEL_LABELS = { EMAIL: 'Email', WHATSAPP: 'WhatsApp', PORTAL: 'Portal' };
export const labelFor = (list, key, field = 'label') => list.find((x) => x.key === key)?.[field] || key?.replaceAll('_', ' ') || '—';
export const countryName = (code) => COUNTRIES.find((c) => c.code === code)?.name || code || '—';
export const countryFlag = (code) => COUNTRIES.find((c) => c.code === code)?.flag || '';

/**
 * Emoji flags depend on an emoji font being installed, which many Linux servers,
 * kiosk browsers and Windows machines lack (they render as tofu boxes). These
 * ISO country codes are always safe to show as a small monospace chip instead.
 */
export const countryChip = (code) => (code && code.length === 2 ? code.toUpperCase() : '');
