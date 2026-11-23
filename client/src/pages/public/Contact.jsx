import { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import PublicNav from '../../components/public/PublicNav';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, Input, Textarea, Select } from '../../components/ui';

const TOPICS = ['Sales enquiry', 'Product support', 'Data privacy request', 'Partnership', 'Other'];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', topic: 'Sales enquiry', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.includes('@') || form.message.trim().length < 10) {
      setError('Please provide your name, a valid email and a message of at least 10 characters.');
      return;
    }
    setError('');
    // No backend CRM for public leads in this build: open a pre-filled mail draft to the vendor inbox.
    const subject = encodeURIComponent(`[ImmigrationFlow] ${form.topic} — ${form.company || form.name}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company || '—'}\nTopic: ${form.topic}\n\n${form.message}`);
    window.location.href = `mailto:support@webamazee.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="bg-white">
      <PublicNav />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.03em] text-ink">Talk to the team</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">Questions about plans, data migration from spreadsheets, or onboarding multiple consultants? Send us a note and we will respond within one business day.</p>
          <div className="mt-7 space-y-4">
            {[[Mail, 'Email', 'support@webamazee.com'], [MessageSquare, 'WhatsApp', 'Available for Business plan customers'], [CheckCircle2, 'Response time', 'Within 1 business day, Mon–Sat']].map(([Icon, t, d]) => (
              <div key={t} className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={15} /></span>
                <div><p className="text-xs font-bold text-ink">{t}</p><p className="text-xs text-ink-soft">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          {sent ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
              <h2 className="mt-3 text-sm font-bold text-ink">Your email draft is ready</h2>
              <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">We opened your mail app with the details filled in. If nothing opened, email support@webamazee.com directly.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3.5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amrita Kaur" />
                <Input label="Work email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@agency.com" />
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Agency name" />
                <Select label="Topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                  {TOPICS.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </div>
              <Textarea label="Message" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your consultancy and what you're looking for…" />
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
              <Button type="submit" icon={Send} className="w-full">Send message</Button>
            </form>
          )}
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
