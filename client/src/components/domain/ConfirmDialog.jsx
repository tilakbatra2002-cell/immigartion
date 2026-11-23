import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../ui';

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', tone = 'danger', requireText, busy }) {
  const [text, setText] = useState('');
  const blocked = requireText && text !== requireText;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" loading={busy} disabled={blocked} onClick={() => { onConfirm(); setText(''); }}>
          {confirmLabel}
        </Button>
      </>}>
      <div className="flex gap-3">
        <div className={cxIcon(tone)}><AlertTriangle size={17} /></div>
        <div className="flex-1 text-sm text-ink-soft">
          {description}
          {requireText && (
            <div className="mt-3">
              <p className="text-xs text-ink">Type <span className="font-mono font-bold text-ink">{requireText}</span> to confirm:</p>
              <input value={text} onChange={(e) => setText(e.target.value)} className="input-base mt-1.5" placeholder={requireText} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
const cxIcon = (tone) => tone === 'danger'
  ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600'
  : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600';
