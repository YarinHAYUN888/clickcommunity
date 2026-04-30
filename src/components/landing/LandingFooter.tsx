import { MapPin, Mail, Phone } from 'lucide-react';
import ClicksLogo from '@/components/ui/ClicksLogo';

const LINK_CLR = 'rgba(255,255,255,0.6)';
const HEAD_CLR = '#FFFFFF';

export default function LandingFooter() {
  return (
    <footer style={{ background: '#08080F' }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 text-right">
          <div>
            <ClicksLogo size={56} glow />
            <p className="mt-2 max-w-[240px] text-[14px]" style={{ color: LINK_CLR }}>
              קהילה של אנשים איכותיים
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[14px]" style={{ color: HEAD_CLR }}>המוצר</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {['מה זה Click', 'המנוי', 'שאלות נפוצות'].map((l) => (
                <li key={l}>
                  <a href="#" className="text-[14px] transition-colors hover:text-white" style={{ color: LINK_CLR }}>{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[14px]" style={{ color: HEAD_CLR }}>חברה</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {['אודות', 'קריירה', 'צור קשר'].map((l) => (
                <li key={l}>
                  <a href="#" className="text-[14px] transition-colors hover:text-white" style={{ color: LINK_CLR }}>{l}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[14px]" style={{ color: HEAD_CLR }}>יצירת קשר</h3>
            <ul className="mt-4 flex flex-col gap-3 text-[14px]" style={{ color: LINK_CLR }}>
              <li className="flex items-center gap-2 flex-row-reverse justify-end">
                <MapPin size={14} style={{ color: '#A78BFA' }} aria-hidden />
                <span>תל אביב, ישראל</span>
              </li>
              <li className="flex items-center gap-2 flex-row-reverse justify-end">
                <Mail size={14} style={{ color: '#A78BFA' }} aria-hidden />
                <span>hello@clicks.app</span>
              </li>
              <li className="flex items-center gap-2 flex-row-reverse justify-end">
                <Phone size={14} style={{ color: '#A78BFA' }} aria-hidden />
                <span>+972-00-0000000</span>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[13px]"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
        >
          <div>© 2026 Clicks. כל הזכויות שמורות.</div>
          <div className="flex items-center gap-3">
            <a href="#" className="transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.4)' }}>תנאי שימוש</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <a href="#" className="transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.4)' }}>מדיניות פרטיות</a>
          </div>
        </div>
      </div>
    </footer>
  );
}