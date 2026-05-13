import { useCallback, useEffect, useState } from 'react';
import { searchAutomationUsers, type RecipientUser } from '@/services/automation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = {
  value: RecipientUser | null;
  onChange: (user: RecipientUser | null) => void;
  disabled?: boolean;
  label?: string;
};

export function AutomationUserPicker({ value, onChange, disabled, label = 'חיפוש משתמש' }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecipientUser[]>([]);
  const [open, setOpen] = useState(false);

  const runSearch = useCallback(async () => {
    const t = q.trim();
    if (t.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchAutomationUsers(t, 25);
      setResults((data.users as RecipientUser[]) || []);
      setOpen(true);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runSearch();
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, runSearch]);

  return (
    <div className="space-y-2 relative">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Input
          dir="ltr"
          placeholder="שם, שם משפחה, אימייל, טלפון או מזהה"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled}
          className="rounded-xl text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => void runSearch()} disabled={disabled || loading}>
          {loading ? '…' : 'חפש'}
        </Button>
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-white shadow-md text-sm">
          {results.map((u) => (
            <li key={u.user_id}>
              <button
                type="button"
                className="w-full text-right px-3 py-2 hover:bg-muted/50 border-b border-border/40 last:border-0"
                onClick={() => {
                  onChange(u);
                  setOpen(false);
                  setQ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email);
                }}
              >
                <span className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</span>
                <span className="block text-xs text-muted-foreground dir-ltr">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <p className="text-xs text-muted-foreground">
          נבחר: <strong dir="ltr">{value.email}</strong>
          <button
            type="button"
            className="mr-2 text-primary underline"
            onClick={() => {
              onChange(null);
              setQ('');
            }}
          >
            נקה
          </button>
        </p>
      )}
    </div>
  );
}
