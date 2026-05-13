import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AudienceProfileRow } from '@/services/automationAudienceProfiles';
import { displayFullName, profilePhotoSrc } from '@/services/automationAudienceProfiles';

type Props = {
  profile: AudienceProfileRow;
  email?: string | null;
  selected: boolean;
  onToggle: () => void;
};

function roleLabel(role: string | null): string {
  if (role === 'member') return 'חבר';
  if (role === 'guest') return 'אורח';
  return role || '—';
}

function moderationShort(m: string): string {
  if (m === 'approved') return 'מאושר';
  if (m === 'pending') return 'ממתין';
  if (m === 'rejected') return 'נדחה';
  return m;
}

export function AudienceMemberCard({ profile, email, selected, onToggle }: Props) {
  const name = displayFullName(profile);
  const photo = profilePhotoSrc(profile);
  const pts = profile.points ?? 0;
  const bday =
    profile.date_of_birth &&
    (() => {
      try {
        return new Date(profile.date_of_birth).toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit',
        });
      } catch {
        return profile.date_of_birth;
      }
    })();
  const interests = (profile.interests || []).slice(0, 4);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={onToggle}
      className={cn(
        'w-full text-right rounded-2xl border p-3 sm:p-4 transition-all shadow-sm',
        'bg-white/85 backdrop-blur-md hover:shadow-md hover:border-violet-300/80',
        selected
          ? 'border-violet-500 ring-2 ring-violet-200/90 shadow-[0_12px_40px_-20px_rgba(124,58,237,0.45)]'
          : 'border-violet-100/80',
      )}
    >
      <div dir="rtl" className="flex gap-3 items-start">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle()}
          className="mt-1.5 shrink-0 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-100 to-violet-50 border border-white shadow-inner">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-lg font-semibold text-violet-700">
              {name.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 text-right">
          <div className="flex flex-wrap items-center gap-1.5 justify-start">
            <p className="font-semibold text-foreground truncate">{name}</p>
            {profile.super_role ? (
              <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-900 border-violet-200">
                מנהל
              </Badge>
            ) : null}
            {pts >= 500 ? (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-900 border-amber-200">
                VIP
              </Badge>
            ) : null}
          </div>
          {email ? (
            <p className="text-xs text-muted-foreground truncate" dir="ltr">
              {email}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">אימייל ייטען בעת האישור</p>
          )}
          <div className="flex flex-wrap gap-1 justify-start">
            <Badge variant="outline" className="text-[10px] font-normal">
              {roleLabel(profile.role)}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {moderationShort(profile.moderation_status)}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {pts} נק׳
            </Badge>
            {bday ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {bday}
              </Badge>
            ) : null}
          </div>
          {interests.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-start pt-0.5">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.button>
  );
}
