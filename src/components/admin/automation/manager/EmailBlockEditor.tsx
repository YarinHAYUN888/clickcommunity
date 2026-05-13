import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EmailBlock, EmailBlockType } from '@/lib/emailBlocks';
import { compileEmailDocumentToHtml, createEmptyTextBlock } from '@/lib/emailBlocks';
import { buildTransactionalEmailHtml } from '@/lib/emailTransactionalHtml';

function SortableBlock({
  block,
  onChange,
  onRemove,
}: {
  block: EmailBlock;
  onChange: (next: EmailBlock) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.85 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-violet-100/90 bg-white/90 backdrop-blur-sm p-3 shadow-sm space-y-2"
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-muted touch-none"
            aria-label="גרירה"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="font-medium text-foreground/80">{block.type}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRemove} aria-label="מחיקה">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {block.type === 'text' && (
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">טקסט (משתנים בסגנון מסולסל כפול סביב שם השדה)</span>
          <textarea
            value={String(block.props.content ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, content: e.target.value } })}
            rows={5}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
      )}
      {block.type === 'hero' && (
        <div className="grid gap-2">
          <Input
            placeholder="כותרת"
            value={String(block.props.title ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, title: e.target.value } })}
            className="bg-white"
          />
          <Input
            placeholder="תת-כותרת"
            value={String(block.props.subtitle ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, subtitle: e.target.value } })}
            className="bg-white"
          />
        </div>
      )}
      {block.type === 'button' && (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="טקסט כפתור"
            value={String(block.props.label ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, label: e.target.value } })}
            className="bg-white"
          />
          <Input
            dir="ltr"
            placeholder="https://… או {{community_url}}"
            value={String(block.props.href ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, href: e.target.value } })}
            className="bg-white"
          />
        </div>
      )}
      {block.type === 'image' && (
        <div className="grid gap-2">
          <Input
            dir="ltr"
            placeholder="כתובת תמונה HTTPS"
            value={String(block.props.src ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, src: e.target.value } })}
            className="bg-white"
          />
          <Input
            placeholder="תיאור (alt)"
            value={String(block.props.alt ?? '')}
            onChange={(e) => onChange({ ...block, props: { ...block.props, alt: e.target.value } })}
            className="bg-white"
          />
        </div>
      )}
      {block.type === 'divider' && <p className="text-xs text-muted-foreground">קו מפריד</p>}
      {block.type === 'spacer' && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground whitespace-nowrap">גובה (px)</span>
          <Input
            type="number"
            min={8}
            max={80}
            className="w-24 bg-white"
            value={Number(block.props.height ?? 16)}
            onChange={(e) =>
              onChange({ ...block, props: { ...block.props, height: Number(e.target.value) || 16 } })
            }
          />
        </label>
      )}
    </div>
  );
}

const ADDABLE: { type: EmailBlockType; label: string }[] = [
  { type: 'text', label: 'טקסט' },
  { type: 'hero', label: 'Hero' },
  { type: 'button', label: 'כפתור' },
  { type: 'image', label: 'תמונה' },
  { type: 'divider', label: 'קו' },
  { type: 'spacer', label: 'רווח' },
];

function newBlock(t: EmailBlockType): EmailBlock {
  const id = `b_${Math.random().toString(36).slice(2, 11)}`;
  switch (t) {
    case 'text':
      return { id, type: 'text', props: { content: '' } };
    case 'hero':
      return { id, type: 'hero', props: { title: '', subtitle: '' } };
    case 'button':
      return { id, type: 'button', props: { label: 'פתיחה', href: '{{community_url}}' } };
    case 'image':
      return { id, type: 'image', props: { src: '', alt: '' } };
    case 'divider':
      return { id, type: 'divider', props: {} };
    case 'spacer':
      return { id, type: 'spacer', props: { height: 16 } };
    default:
      return createEmptyTextBlock();
  }
}

export function EmailBlockEditor({
  subject,
  blocks,
  onSubjectChange,
  onBlocksChange,
}: {
  subject: string;
  blocks: EmailBlock[];
  onSubjectChange: (s: string) => void;
  onBlocksChange: (b: EmailBlock[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const innerHtml = useMemo(() => compileEmailDocumentToHtml(blocks), [blocks]);

  const previewDoc = useMemo(() => {
    const logo = import.meta.env.VITE_EMAIL_LOGO_URL?.trim();
    return buildTransactionalEmailHtml({
      logoUrl: logo || undefined,
      subjectLine: subject || 'תצוגה מקדימה',
      bodyText: '',
      bodyHtmlFragment: innerHtml,
      footerLine: 'צוות Clicks',
      brandAccentColor: '#7c3aed',
    });
  }, [innerHtml, subject]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
  }

  function updateAt(i: number, next: EmailBlock) {
    const copy = [...blocks];
    copy[i] = next;
    onBlocksChange(copy);
  }

  function removeAt(i: number) {
    onBlocksChange(blocks.filter((_, j) => j !== i));
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">נושא</span>
          <Input value={subject} onChange={(e) => onSubjectChange(e.target.value)} className="bg-white" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ADDABLE.map((a) => (
            <Button
              key={a.type}
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => onBlocksChange([...blocks, newBlock(a.type)])}
            >
              + {a.label}
            </Button>
          ))}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <SortableBlock
                  key={b.id}
                  block={b}
                  onChange={(nb) => updateAt(i, nb)}
                  onRemove={() => removeAt(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div className="space-y-2 lg:sticky lg:top-4">
        <p className="text-xs font-semibold text-muted-foreground">תצוגה מקדימה</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] text-center text-muted-foreground mb-1">שולחן</p>
            <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
              <iframe title="desktop" className="w-full h-[420px] border-0 bg-white" srcDoc={previewDoc} />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-center text-muted-foreground mb-1">נייד</p>
            <div className="rounded-xl border border-border overflow-hidden bg-muted/30 max-w-[200px] mx-auto">
              <iframe title="mobile" className="w-[200px] h-[420px] border-0 bg-white" srcDoc={previewDoc} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
