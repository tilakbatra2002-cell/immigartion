/**
 * Permission catalog + role defaults.
 * Organization owners can grant/revoke individual permissions per role in
 * Settings → Roles & Permissions. The SaaS Super Admin bypasses org checks.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  LEADS_VIEW: 'leads.view', LEADS_CREATE: 'leads.create', LEADS_UPDATE: 'leads.update', LEADS_DELETE: 'leads.delete', LEADS_ASSIGN: 'leads.assign', LEADS_EXPORT: 'leads.export',
  CLIENTS_VIEW: 'clients.view', CLIENTS_CREATE: 'clients.create', CLIENTS_UPDATE: 'clients.update', CLIENTS_DELETE: 'clients.delete', CLIENTS_SENSITIVE: 'clients.sensitive',
  CASES_VIEW: 'cases.view', CASES_CREATE: 'cases.create', CASES_UPDATE: 'cases.update', CASES_DELETE: 'cases.delete', CASES_ASSIGN: 'cases.assign', CASES_WORKFLOW: 'cases.workflow',
  DOCS_VIEW: 'documents.view', DOCS_UPLOAD: 'documents.upload', DOCS_VERIFY: 'documents.verify', DOCS_DELETE: 'documents.delete', DOCS_TEMPLATES: 'documents.templates',
  APPT_VIEW: 'appointments.view', APPT_MANAGE: 'appointments.manage',
  TASKS_VIEW: 'tasks.view', TASKS_CREATE: 'tasks.create', TASKS_UPDATE: 'tasks.update', TASKS_DELETE: 'tasks.delete',
  INVOICES_VIEW: 'invoices.view', INVOICES_CREATE: 'invoices.create', INVOICES_UPDATE: 'invoices.update', INVOICES_DELETE: 'invoices.delete', PAYMENTS_RECORD: 'payments.record',
  COMMS_VIEW: 'communications.view', COMMS_SEND: 'communications.send', COMMS_TEMPLATES: 'communications.templates',
  REPORTS_VIEW: 'reports.view', REPORTS_EXPORT: 'reports.export',
  AI_USE: 'ai.use',
  TEAM_VIEW: 'team.view', TEAM_MANAGE: 'team.manage', ROLES_MANAGE: 'roles.manage', AUDIT_VIEW: 'audit.view',
  SETTINGS_VIEW: 'settings.view', SETTINGS_MANAGE: 'settings.manage',
  BILLING_VIEW: 'billing.view', BILLING_MANAGE: 'billing.manage',
};

const P = PERMISSIONS;
const ALL = Object.values(P);

// CLIENT is a portal-only role — never granted internal permissions.
export const ROLE_PERMISSIONS = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== P.BILLING_MANAGE), // owner-only billing changes by default
  CONSULTANT: [
    P.DASHBOARD_VIEW, P.LEADS_VIEW, P.LEADS_CREATE, P.LEADS_UPDATE, P.LEADS_ASSIGN,
    P.CLIENTS_VIEW, P.CLIENTS_CREATE, P.CLIENTS_UPDATE, P.CLIENTS_SENSITIVE,
    P.CASES_VIEW, P.CASES_CREATE, P.CASES_UPDATE, P.CASES_ASSIGN, P.CASES_WORKFLOW,
    P.DOCS_VIEW, P.DOCS_UPLOAD, P.DOCS_VERIFY,
    P.APPT_VIEW, P.APPT_MANAGE, P.TASKS_VIEW, P.TASKS_CREATE, P.TASKS_UPDATE,
    P.INVOICES_VIEW, P.COMMS_VIEW, P.COMMS_SEND, P.COMMS_TEMPLATES,
    P.REPORTS_VIEW, P.AI_USE, P.TEAM_VIEW, P.SETTINGS_VIEW,
  ],
  CASE_MANAGER: [
    P.DASHBOARD_VIEW, P.LEADS_VIEW, P.CLIENTS_VIEW, P.CLIENTS_UPDATE,
    P.CASES_VIEW, P.CASES_UPDATE, P.CASES_WORKFLOW,
    P.DOCS_VIEW, P.DOCS_UPLOAD, P.DOCS_VERIFY,
    P.APPT_VIEW, P.APPT_MANAGE, P.TASKS_VIEW, P.TASKS_CREATE, P.TASKS_UPDATE, P.TASKS_DELETE,
    P.COMMS_VIEW, P.COMMS_SEND, P.REPORTS_VIEW, P.AI_USE, P.TEAM_VIEW,
  ],
  ACCOUNTANT: [
    P.DASHBOARD_VIEW, P.CLIENTS_VIEW, P.CASES_VIEW, P.INVOICES_VIEW, P.INVOICES_CREATE,
    P.INVOICES_UPDATE, P.INVOICES_DELETE, P.PAYMENTS_RECORD, P.REPORTS_VIEW, P.REPORTS_EXPORT,
    P.BILLING_VIEW, P.SETTINGS_VIEW, P.TEAM_VIEW,
  ],
  VIEWER: [
    P.DASHBOARD_VIEW, P.LEADS_VIEW, P.CLIENTS_VIEW, P.CASES_VIEW, P.DOCS_VIEW,
    P.APPT_VIEW, P.TASKS_VIEW, P.INVOICES_VIEW, P.COMMS_VIEW, P.REPORTS_VIEW, P.TEAM_VIEW,
  ],
};

export const ORG_ROLES = ['OWNER', 'ADMIN', 'CONSULTANT', 'CASE_MANAGER', 'ACCOUNTANT', 'VIEWER'];
export const INVITABLE_ROLES = ['ADMIN', 'CONSULTANT', 'CASE_MANAGER', 'ACCOUNTANT', 'VIEWER'];

export const ROLE_LABELS = {
  SAAS_ADMIN: 'SaaS Super Admin', OWNER: 'Owner', ADMIN: 'Admin', CONSULTANT: 'Consultant',
  CASE_MANAGER: 'Case Manager', ACCOUNTANT: 'Accountant', VIEWER: 'Viewer', CLIENT: 'Client',
};

/** Resolve effective permissions for a membership role, honouring org overrides. */
export function effectivePermissions(role, overrides = {}) {
  if (role === 'OWNER') return ALL;
  const base = new Set(ROLE_PERMISSIONS[role] || []);
  const o = overrides?.[role] || {};
  for (const p of o.grants || []) if (ALL.includes(p)) base.add(p);
  for (const p of o.revokes || []) base.delete(p);
  // Guardrails: nobody except OWNER can manage roles or billing changes.
  base.delete(P.ROLES_MANAGE);
  base.delete(P.BILLING_MANAGE);
  return [...base];
}
