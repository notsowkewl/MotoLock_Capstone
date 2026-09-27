import { useState } from 'react';

export default function SettingsSave({ dirty, onSave }: { dirty: boolean; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  return <div className="settings-save">
    <span role="status">{saving ? 'Saving changes...' : dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
    <button disabled={!dirty || saving} onClick={async () => {
      setSaving(true);
      try { await onSave(); } finally { setSaving(false); }
    }}>{saving ? 'Saving...' : 'Save Changes'}</button>
  </div>;
}
