export const PLANS = {
  STARTER: {
    key: 'STARTER', name: 'Starter', order: 1,
    description: 'For solo consultants getting organized.',
    price: { INR: 1999, USD: 29, GBP: 23, AUD: 45, NZD: 49, CAD: 39 },
    limits: { users: 2, activeLeads: 100, activeCases: 25, ai: false, clientPortal: false, advancedReports: false, customWorkflows: false },
    features: ['CRM & lead pipeline', '25 active cases', 'Document management (5 GB)', 'Email support'],
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL', name: 'Professional', order: 2, popular: true,
    description: 'For growing consultancy teams.',
    price: { INR: 4999, USD: 69, GBP: 55, AUD: 105, NZD: 115, CAD: 95 },
    limits: { users: 10, activeLeads: 1000, activeCases: 500, ai: true, clientPortal: true, advancedReports: true, customWorkflows: true },
    features: ['Everything in Starter', 'AI assistance', 'Client portal', 'Advanced reports', 'Automation & workflows'],
  },
  BUSINESS: {
    key: 'BUSINESS', name: 'Business', order: 3,
    description: 'For established immigration firms.',
    price: { INR: 11999, USD: 169, GBP: 129, AUD: 249, NZD: 269, CAD: 229 },
    limits: { users: 30, activeLeads: 5000, activeCases: 2000, ai: true, clientPortal: true, advancedReports: true, customWorkflows: true },
    features: ['Everything in Professional', 'Advanced permissions', 'Priority support', 'Audit logs', 'Higher usage limits'],
  },
};

export const PLAN_KEYS = Object.keys(PLANS);
export const TRIAL_DAYS = 14;
export const ACTIVE_CASE_STATUSES = [
  'INITIAL_ENQUIRY', 'CONSULTATION', 'DOCUMENTS_PENDING', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW',
  'READY_FOR_SUBMISSION', 'SUBMITTED', 'ADDITIONAL_INFO_REQUESTED', 'DECISION_RECEIVED',
];

export function planFor(key) {
  return PLANS[key] || PLANS.STARTER;
}

export function planHasFeature(planKey, feature) {
  const plan = planFor(planKey);
  return Boolean(plan.limits[feature]);
}
