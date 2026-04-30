import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { SupabaseProfile } from '@/hooks/useCurrentUser';

interface IcebreakerSheetProps {
  open: boolean;
  onClose: () => void;
  targetProfile: SupabaseProfile;
  sharedInterests: string[];
  onSend: (message: string) => void;
}

function generateSuggestions(name: string, sharedInterests: string[]): string[] {
  const suggestions: string[] = [];
  if (sharedInterests.includes('טיולים')) {
    suggestions.push(`היי ${name}, חייב/ת לשמוע לאן היה הטיול האחרון שלך! 🌍`);
  }
  suggestions.push(`הייי ${name}, איזה כיף שנראה בקליק הקרוב! 🎉`);
  if (sharedInterests.length > 0) {
    suggestions.push(`היי ${name}, ראיתי שגם את/ה אוהב/ת ${sharedInterests[0]} — מה הדבר האחרון שעשית בנושא? 😊`);
  }
  return suggestions.slice(0, 3);
}

export default function IcebreakerSheet({ open, onClose, targetProfile, sharedInterests, onSend }: IcebreakerSheetProps) {
  const name = targetProfile.first_name || 'שם';
  const suggestions = generateSuggestions(name, sharedInterests);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSelectSuggestion = (idx: number) => {
    setSelectedIdx(idx);
    setText(suggestions[idx]);
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 500));
    onSend(text);
    toast.success('ההודעה נשלחה!');
    setSending(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2}
            onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
            className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
            style={{ maxWidth: 480, margin: '0 auto' }}
          >
            <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-muted" /></div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-semibold text-foreground">שובר קרח 🧊</h3>
              <button onClick={onClose} className="text-muted-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">בחר/י הודעת פתיחה או כתוב/י משלך</p>
            <div className="space-y-2.5 mb-4">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => handleSelectSuggestion(i)} className={`w-full text-right p-3.5 rounded-2xl border transition-all text-[15px] leading-relaxed ${selectedIdx === i ? 'border-2 border-primary bg-secondary' : 'border-border bg-card'}`}>{s}</button>
              ))}
            </div>
            <Textarea value={text} onChange={e => { setText(e.target.value); setSelectedIdx(null); }} placeholder="כתוב/י הודעה משלך..." rows={3} className="rounded-2xl border-border text-[15px] mb-4" />
            <motion.button onClick={handleSend} disabled={!text.trim() || sending} whileTap={{ scale: 0.95 }} className={`w-full rounded-full py-3 font-semibold text-base text-primary-foreground gradient-primary transition-opacity ${!text.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {sending ? 'נשלח ✓' : 'שלח/י'}
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
