import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import PortalLayout from './components/layout/PortalLayout';
import AdminLayout from './components/layout/AdminLayout';
import CommandPalette from './components/layout/CommandPalette';
import { PageSkeleton, Spinner } from './components/ui';

/* Public */
const Landing = lazy(() => import('./pages/public/Landing'));
const Features = lazy(() => import('./pages/public/Features'));
const Pricing = lazy(() => import('./pages/public/Pricing'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Login = lazy(() => import('./pages/public/Login'));
const Register = lazy(() => import('./pages/public/Register'));
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/public/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/public/VerifyEmail'));
const AcceptInvite = lazy(() => import('./pages/public/AcceptInvite'));
const Onboarding = lazy(() => import('./pages/public/Onboarding'));

/* App */
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Leads = lazy(() => import('./pages/app/Leads'));
const LeadDetail = lazy(() => import('./pages/app/LeadDetail'));
const Clients = lazy(() => import('./pages/app/Clients'));
const ClientDetail = lazy(() => import('./pages/app/ClientDetail'));
const Cases = lazy(() => import('./pages/app/Cases'));
const CaseDetail = lazy(() => import('./pages/app/CaseDetail'));
const Documents = lazy(() => import('./pages/app/Documents'));
const Appointments = lazy(() => import('./pages/app/Appointments'));
const Tasks = lazy(() => import('./pages/app/Tasks'));
const Invoices = lazy(() => import('./pages/app/Invoices'));
const Communications = lazy(() => import('./pages/app/Communications'));
const Reports = lazy(() => import('./pages/app/Reports'));
const AIAssistant = lazy(() => import('./pages/app/AIAssistant'));
const Team = lazy(() => import('./pages/app/Team'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Subscription = lazy(() => import('./pages/app/Subscription'));

/* Portal */
const PortalLogin = lazy(() => import('./pages/portal/PortalLogin'));
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'));
const PortalCases = lazy(() => import('./pages/portal/PortalCases'));
const PortalCaseDetail = lazy(() => import('./pages/portal/PortalCaseDetail'));
const PortalDocuments = lazy(() => import('./pages/portal/PortalDocuments'));
const PortalAppointments = lazy(() => import('./pages/portal/PortalAppointments'));
const PortalMessages = lazy(() => import('./pages/portal/PortalMessages'));
const PortalInvoices = lazy(() => import('./pages/portal/PortalInvoices'));
const PortalProfile = lazy(() => import('./pages/portal/PortalProfile'));

/* Admin */
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOrganizations = lazy(() => import('./pages/admin/AdminOrganizations'));
const AdminOrganizationDetail = lazy(() => import('./pages/admin/AdminOrganizationDetail'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

function FullScreenLoader() {
  return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner className="h-6 w-6" /></div>;
}

function RequireAuth({ children }) {
  const { user, booting, portal } = useAuth();
  const loc = useLocation();
  if (booting) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (portal) return <Navigate to="/portal" replace />;
  return children;
}

function RequirePortalAuth({ children }) {
  const { user, booting, portal } = useAuth();
  const loc = useLocation();
  if (booting) return <FullScreenLoader />;
  if (!user || !portal) return <Navigate to="/portal/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function RequireSuperAdmin({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/app/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, booting, portal } = useAuth();
  if (booting) return <FullScreenLoader />;
  if (user && !portal) return <Navigate to="/app/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas p-6"><PageSkeleton /></div>}>
      <CommandPalette />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />

        {/* Onboarding (auth required, no layout) */}
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

        {/* Client portal */}
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<RequirePortalAuth><PortalLayout /></RequirePortalAuth>}>
          <Route index element={<PortalDashboard />} />
          <Route path="cases" element={<PortalCases />} />
          <Route path="cases/:id" element={<PortalCaseDetail />} />
          <Route path="documents" element={<PortalDocuments />} />
          <Route path="appointments" element={<PortalAppointments />} />
          <Route path="messages" element={<PortalMessages />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="profile" element={<PortalProfile />} />
        </Route>

        {/* Super admin */}
        <Route path="/admin" element={<RequireSuperAdmin><AdminLayout /></RequireSuperAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="organizations" element={<AdminOrganizations />} />
          <Route path="organizations/:id" element={<AdminOrganizationDetail />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Organization app */}
        <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="cases" element={<Cases />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="documents" element={<Documents />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<Invoices />} />
          <Route path="communications" element={<Communications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="team" element={<Team />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
