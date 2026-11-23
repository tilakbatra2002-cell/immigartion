export const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', dial: '+91' },
  { code: 'AU', name: 'Australia', currency: 'AUD', dial: '+61' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', dial: '+64' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', dial: '+44' },
  { code: 'CA', name: 'Canada', currency: 'CAD', dial: '+1' },
  { code: 'US', name: 'United States', currency: 'USD', dial: '+1' },
];
// Residency can be broader than destinations
export const RESIDENCE_COUNTRIES = [
  ...COUNTRIES,
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SG', name: 'Singapore' },
  { code: 'DE', name: 'Germany' }, { code: 'IE', name: 'Ireland' }, { code: 'PH', name: 'Philippines' },
  { code: 'NG', name: 'Nigeria' }, { code: 'ZA', name: 'South Africa' }, { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' }, { code: 'NP', name: 'Nepal' }, { code: 'LK', name: 'Sri Lanka' },
  { code: 'OTHER', name: 'Other' },
];

export const VISA_CATEGORIES = [
  { key: 'STUDENT_VISA', label: 'Student Visa' },
  { key: 'WORK_VISA', label: 'Work Visa' },
  { key: 'VISITOR_VISA', label: 'Visitor Visa' },
  { key: 'PERMANENT_RESIDENCY', label: 'Permanent Residency' },
  { key: 'SKILLED_MIGRATION', label: 'Skilled Migration' },
  { key: 'FAMILY_SPONSORSHIP', label: 'Family Sponsorship' },
  { key: 'BUSINESS_IMMIGRATION', label: 'Business Immigration' },
  { key: 'CITIZENSHIP', label: 'Citizenship' },
  { key: 'OTHER', label: 'Other' },
];

export const CASE_STATUSES = [
  { key: 'INITIAL_ENQUIRY', label: 'Initial Enquiry', color: 'slate', order: 1, active: true },
  { key: 'CONSULTATION', label: 'Consultation', color: 'sky', order: 2, active: true },
  { key: 'DOCUMENTS_PENDING', label: 'Documents Pending', color: 'amber', order: 3, active: true },
  { key: 'DOCUMENTS_RECEIVED', label: 'Documents Received', color: 'blue', order: 4, active: true },
  { key: 'UNDER_REVIEW', label: 'Under Review', color: 'indigo', order: 5, active: true },
  { key: 'READY_FOR_SUBMISSION', label: 'Ready for Submission', color: 'violet', order: 6, active: true },
  { key: 'SUBMITTED', label: 'Submitted', color: 'cyan', order: 7, active: true },
  { key: 'ADDITIONAL_INFO_REQUESTED', label: 'Additional Information Requested', color: 'orange', order: 8, active: true },
  { key: 'DECISION_RECEIVED', label: 'Decision Received', color: 'purple', order: 9, active: true },
  { key: 'APPROVED', label: 'Approved', color: 'green', order: 10, active: false, terminal: true },
  { key: 'REFUSED', label: 'Refused', color: 'red', order: 11, active: false, terminal: true },
  { key: 'WITHDRAWN', label: 'Withdrawn', color: 'stone', order: 12, active: false, terminal: true },
  { key: 'CLOSED', label: 'Closed', color: 'gray', order: 13, active: false, terminal: true },
];

export const LEAD_STATUSES = [
  { key: 'NEW', label: 'New', color: 'sky' },
  { key: 'CONTACTED', label: 'Contacted', color: 'blue' },
  { key: 'CONSULTATION_BOOKED', label: 'Consultation Booked', color: 'indigo' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'violet' },
  { key: 'CONVERTED', label: 'Converted', color: 'green' },
  { key: 'LOST', label: 'Lost', color: 'red' },
];
export const CONVERTIBLE_LEAD_STATUSES = ['NEW', 'CONTACTED', 'CONSULTATION_BOOKED', 'QUALIFIED'];

export const LEAD_SOURCES = ['WEBSITE', 'REFERRAL', 'WALK_IN', 'SOCIAL_MEDIA', 'GOOGLE_ADS', 'EVENT', 'PARTNER', 'PHONE', 'EMAIL', 'OTHER'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const DOC_CATEGORIES = [
  { key: 'PASSPORT', label: 'Passport' },
  { key: 'PHOTOGRAPH', label: 'Photograph' },
  { key: 'EDUCATIONAL_CERTIFICATES', label: 'Educational Certificates' },
  { key: 'EMPLOYMENT_RECORDS', label: 'Employment Records' },
  { key: 'FINANCIAL_DOCUMENTS', label: 'Financial Documents' },
  { key: 'BANK_STATEMENTS', label: 'Bank Statements' },
  { key: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
  { key: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { key: 'MEDICAL_DOCUMENTS', label: 'Medical Documents' },
  { key: 'POLICE_CLEARANCE', label: 'Police Clearance' },
  { key: 'VISA_FORMS', label: 'Visa Forms' },
  { key: 'OTHER', label: 'Other' },
];
export const DOC_STATUSES = ['REQUIRED', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'];
export const DOC_ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const DOC_MAX_BYTES = 20 * 1024 * 1024;

export const APPOINTMENT_TYPES = ['INITIAL_CONSULTATION', 'DOCUMENT_REVIEW', 'FOLLOW_UP', 'CASE_DISCUSSION', 'GENERAL_CONSULTATION'];
export const APPOINTMENT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const TASK_RECURRENCE = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
export const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'UPI', 'CARD', 'STRIPE', 'RAZORPAY', 'CHEQUE', 'OTHER'];
export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

export const MESSAGE_CHANNELS = ['EMAIL', 'WHATSAPP', 'PORTAL'];
export const MESSAGE_DIRECTIONS = ['OUTBOUND', 'INBOUND', 'INTERNAL'];

export const ORG_BUSINESS_TYPES = [
  'Immigration Consultancy', 'Visa Agency', 'Overseas Education Consultancy', 'Immigration Law Firm', 'Other',
];
export const ORG_TIMEZONES = [
  'Asia/Kolkata', 'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland', 'Europe/London',
  'America/Toronto', 'America/Vancouver', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore',
];

export const NOTIFICATION_TYPES = [
  'LEAD_ASSIGNED', 'CASE_ASSIGNED', 'CASE_STATUS_CHANGED', 'TASK_ASSIGNED', 'TASK_DUE',
  'APPOINTMENT_REMINDER', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED', 'INVOICE_SENT', 'PAYMENT_RECEIVED',
  'MESSAGE_RECEIVED', 'TEAM_INVITE', 'SUBSCRIPTION', 'SYSTEM',
];
