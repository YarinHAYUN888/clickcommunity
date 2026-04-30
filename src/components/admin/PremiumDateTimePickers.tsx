import { forwardRef, useEffect, useRef, useState } from 'react';
import { format, parse } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/* ================== PremiumDatePicker ================== */

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PremiumDatePicker({
  value,
  onChange,
  placeholder = 'בחרו תאריך',
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'group relative w-full h-12 rounded-2xl bg-white/70 backdrop-blur-sm border border-primary/15 px-4 text-sm transition-all',
            'flex items-center justify-between gap-2',
            'hover:border-primary/30 hover:bg-white/85 hover:shadow-[0_2px_10px_rgba(124,58,237,0.10)]',
            'focus:outline-none focus:border-primary/50 focus:bg-white/95 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18)]',
            'data-[state=open]:border-primary/50 data-[state=open]:shadow-[0_0_0_3px_rgba(124,58,237,0.18)] data-[state=open]:bg-white/95',
            value ? 'text-foreground' : 'text-foreground/40',
            disabled && 'opacity-60 cursor-not-allowed',
            className,
          )}
        >
          <span className="truncate">
            {selected ? format(selected, "d 'ב'MMMM yyyy", { locale: he }) : placeholder}
          </span>
          <span
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'rgba(124,58,237,0.10)' }}
          >
            <CalendarDays size={14} className="text-primary" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="p-0 w-auto rounded-3xl border-0 overflow-hidden glass-premium"
        style={{ boxShadow: '0 20px 56px rgba(124,58,237,0.22), 0 4px 12px rgba(124,58,237,0.10)' }}
      >
        {/* Header strip */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.06))' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
              boxShadow: '0 4px 12px rgba(124,58,237,0.32)',
            }}
          >
            <CalendarDays size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary leading-none">
              בחירת תאריך
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selected ? format(selected, "EEEE, d 'ב'MMMM yyyy", { locale: he }) : 'לא נבחר תאריך'}
            </p>
          </div>
        </div>

        <div className="p-3 pt-2" dir="rtl">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            locale={he}
            weekStartsOn={0}
            showOutsideDays
            classNames={{
              months: 'flex flex-col',
              month: 'space-y-2',
              caption: 'flex justify-center pt-1 pb-1 relative items-center',
              caption_label: 'text-sm font-bold text-foreground',
              nav: 'flex items-center gap-1',
              nav_button:
                'h-7 w-7 inline-flex items-center justify-center rounded-full hover:bg-primary/10 text-primary transition-colors',
              nav_button_previous: 'absolute right-1',
              nav_button_next: 'absolute left-1',
              table: 'w-full border-collapse',
              head_row: 'flex',
              head_cell:
                'text-muted-foreground w-10 font-semibold text-[11px] uppercase tracking-wider',
              row: 'flex w-full mt-1',
              cell: 'h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
              day: cn(
                'h-10 w-10 p-0 font-medium rounded-xl text-foreground transition-all',
                'hover:bg-primary/10 hover:text-primary',
                'aria-selected:opacity-100',
              ),
              day_selected:
                '!bg-gradient-to-br !from-primary !to-pink-500 !text-white !font-bold shadow-[0_6px_16px_rgba(124,58,237,0.4)] hover:!opacity-95',
              day_today: 'bg-primary/10 text-primary font-bold ring-1 ring-primary/30',
              day_outside: 'text-muted-foreground/40',
              day_disabled: 'text-muted-foreground/30 cursor-not-allowed',
              day_hidden: 'invisible',
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
            }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-primary/10">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
          >
            נקה
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(format(new Date(), 'yyyy-MM-dd'));
              setOpen(false);
            }}
            className="h-8 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            היום
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ================== PremiumTimePicker ================== */

interface TimePickerProps {
  value: string; // 'HH:MM'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minuteStep?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export function PremiumTimePicker({
  value,
  onChange,
  placeholder = 'בחרו שעה',
  className,
  disabled,
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) =>
    String(i * minuteStep).padStart(2, '0'),
  );
  const [hh, mm] = value ? value.split(':') : ['', ''];
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const hSel = hoursRef.current?.querySelector(
        '[data-selected="true"]',
      ) as HTMLElement | null;
      hSel?.scrollIntoView({ block: 'center' });
      const mSel = minutesRef.current?.querySelector(
        '[data-selected="true"]',
      ) as HTMLElement | null;
      mSel?.scrollIntoView({ block: 'center' });
    }, 30);
    return () => clearTimeout(t);
  }, [open]);

  const setHour = (h: string) => onChange(`${h}:${mm || '00'}`);
  const setMinute = (m: string) => onChange(`${hh || '00'}:${m}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'group relative w-full h-12 rounded-2xl bg-white/70 backdrop-blur-sm border border-primary/15 px-4 text-sm transition-all',
            'flex items-center justify-between gap-2',
            'hover:border-primary/30 hover:bg-white/85 hover:shadow-[0_2px_10px_rgba(124,58,237,0.10)]',
            'focus:outline-none focus:border-primary/50 focus:bg-white/95 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.18)]',
            'data-[state=open]:border-primary/50 data-[state=open]:shadow-[0_0_0_3px_rgba(124,58,237,0.18)] data-[state=open]:bg-white/95',
            value ? 'text-foreground tabular-nums' : 'text-foreground/40',
            disabled && 'opacity-60 cursor-not-allowed',
            className,
          )}
        >
          <span>{value || placeholder}</span>
          <span
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: 'rgba(124,58,237,0.10)' }}
          >
            <Clock size={14} className="text-primary" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className="p-0 w-auto rounded-3xl border-0 overflow-hidden glass-premium"
        style={{ boxShadow: '0 20px 56px rgba(124,58,237,0.22), 0 4px 12px rgba(124,58,237,0.10)' }}
      >
        {/* Header strip */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(236,72,153,0.06))' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
              boxShadow: '0 4px 12px rgba(124,58,237,0.32)',
            }}
          >
            <Clock size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary leading-none">
              בחירת שעה
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {value || '--:--'}
            </p>
          </div>
        </div>

        <div className="p-3">
          <div className="flex items-stretch gap-2" dir="ltr">
            <TimeColumn ref={hoursRef} label="שעה" items={HOURS} value={hh} onSelect={setHour} />
            <div className="flex items-center text-2xl font-bold text-primary/40 select-none px-1">
              :
            </div>
            <TimeColumn ref={minutesRef} label="דקות" items={minutes} value={mm} onSelect={setMinute} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-primary/10">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
          >
            נקה
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 px-4 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              boxShadow: '0 4px 12px rgba(124,58,237,0.32)',
            }}
          >
            סיום
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TimeColumnProps {
  label: string;
  items: string[];
  value: string;
  onSelect: (v: string) => void;
}

const TimeColumn = forwardRef<HTMLDivElement, TimeColumnProps>(function TimeColumn(
  { label, items, value, onSelect },
  ref,
) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5"
        dir="rtl"
      >
        {label}
      </span>
      <div
        ref={ref}
        className="h-44 w-16 overflow-y-auto py-1 rounded-xl"
        style={{
          background: 'rgba(124,58,237,0.04)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(124,58,237,0.25) transparent',
        }}
      >
        <div className="flex flex-col gap-1 px-1">
          {items.map((it) => {
            const sel = it === value;
            return (
              <button
                key={it}
                type="button"
                data-selected={sel}
                onClick={() => onSelect(it)}
                className={cn(
                  'h-9 rounded-lg text-sm font-semibold tabular-nums transition-all',
                  sel
                    ? 'text-white shadow-[0_4px_12px_rgba(124,58,237,0.32)]'
                    : 'text-foreground/70 hover:bg-primary/10 hover:text-primary',
                )}
                style={
                  sel
                    ? { background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }
                    : undefined
                }
              >
                {it}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
