import { useMemo, useRef, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Molecule } from '@/components/chem/Molecule'
import { SmilesPresetSelect } from '@/components/admin/SmilesPresetSelect'
import {
  buildMolDrawing,
  findMolTags,
  formatMolTag,
  type MolStyle,
  type MolTag,
} from '@/lib/chem/draw'

const STYLES: { value: MolStyle; label: string; hint: string }[] = [
  { value: 'skeletal', label: 'Skeletal', hint: 'Zig-zag lines' },
  { value: 'structural', label: 'Structural', hint: 'CH3 groups written out' },
  { value: 'displayed', label: 'Displayed', hint: 'Every atom and bond' },
]

const EXAMPLES = ['CH3CH(OH)CH3', 'CH3COOC2H5', '(CH3)3CCl', 'CH2=CHCH3', 'C6H5COOH']

const EMPTY: MolTag = { input: '', style: 'skeletal', kind: 'auto' }

/**
 * Button that opens a small molecule builder and writes a [[mol:...]] tag into
 * the text field it sits beside. It can also re-open a tag that is already in
 * the field so it can be changed without retyping.
 */
export function MoleculeInsertButton({
  value,
  onChange,
  compact = false,
}: {
  value: string
  onChange: (next: string) => void
  /** Icon-only button, for tight rows such as answer options. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<MolTag>(EMPTY)
  /** Index into the field's existing tags when editing one, otherwise -1. */
  const [editing, setEditing] = useState(-1)
  const [presetNonce, setPresetNonce] = useState(0)
  const caret = useRef<number | null>(null)

  const existing = useMemo(() => (open ? findMolTags(value) : []), [open, value])
  const result = useMemo(
    () => (tag.input.trim() ? buildMolDrawing(tag.input, { style: tag.style, kind: tag.kind }) : null),
    [tag.input, tag.style, tag.kind],
  )
  const canInsert = Boolean(result && !result.error)

  const rememberCaret = () => {
    // Runs on mouse-down, before focus leaves the text field, so a tag can go where the cursor was.
    const el = document.activeElement
    const isField = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
    caret.current = isField && el.value === value ? el.selectionStart : null
  }

  const openBuilder = () => {
    const tags = findMolTags(value)
    const at = caret.current
    const under = at === null ? -1 : tags.findIndex((t) => at >= t.start && at <= t.end)
    setEditing(under)
    setTag(under >= 0 ? tags[under].tag : EMPTY)
    setOpen(true)
  }

  const apply = () => {
    if (!canInsert) return
    const text = formatMolTag(tag)
    if (editing >= 0 && existing[editing]) {
      const { start, end } = existing[editing]
      onChange(value.slice(0, start) + text + value.slice(end))
    } else if (caret.current !== null && caret.current <= value.length) {
      onChange(value.slice(0, caret.current) + text + value.slice(caret.current))
    } else {
      onChange(value && !/\s$/.test(value) ? `${value} ${text}` : `${value}${text}`)
    }
    setOpen(false)
  }

  const field = 'bg-white/5 border-white/10 text-white placeholder:text-white/30'

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        title="Insert molecule"
        aria-label="Insert molecule"
        className={`text-cyan-300/80 hover:text-cyan-200 hover:bg-cyan-500/10 flex-shrink-0 ${
          compact ? 'h-10 w-10 p-0' : 'h-7 text-xs px-2'
        }`}
        onMouseDown={rememberCaret}
        onClick={openBuilder}
      >
        <FlaskConical className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5 mr-1'} />
        {!compact && 'Insert molecule'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editing >= 0 ? 'Edit molecule' : 'Insert molecule'}</DialogTitle>
            <DialogDescription className="text-white/50">
              Type the structural formula as the paper prints it, or SMILES for rings.
            </DialogDescription>
          </DialogHeader>

          {existing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-white/50">In this field:</span>
              {existing.map((t, i) => (
                <button
                  key={`${t.start}-${i}`}
                  type="button"
                  onClick={() => {
                    setEditing(i)
                    setTag(t.tag)
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                    editing === i
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t.tag.label ? `${t.tag.label}: ` : ''}
                  {t.tag.input}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEditing(-1)
                  setTag(EMPTY)
                }}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  editing < 0
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                + New
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/70 mb-1 block">Formula or SMILES</label>
              <Input
                autoFocus
                value={tag.input}
                onChange={(e) => setTag({ ...tag, input: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    apply()
                  }
                }}
                spellCheck={false}
                className={`${field} font-mono`}
                placeholder="CH3CH(OH)CH3"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setTag({ ...tag, input: ex })}
                    className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60 hover:bg-white/10"
                  >
                    {ex}
                  </button>
                ))}
                <SmilesPresetSelect
                  nonce={presetNonce}
                  triggerClassName="h-6 w-[170px] bg-white/5 border-white/10 text-white text-[11px]"
                  onPick={(smiles) => {
                    setTag({ ...tag, input: smiles })
                    setPresetNonce((n) => n + 1)
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTag({ ...tag, style: s.value })}
                  className={`rounded-lg border px-2 py-1.5 text-left ${
                    tag.style === s.value
                      ? 'border-cyan-400/60 bg-cyan-500/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-white/50">{s.hint}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_110px_auto] gap-2 items-end">
              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">Label (optional)</label>
                <Input
                  value={tag.label ?? ''}
                  onChange={(e) => setTag({ ...tag, label: e.target.value || undefined })}
                  className={field}
                  placeholder="e.g. S, or limonene"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">Rotate (°)</label>
                <Input
                  type="number"
                  step={30}
                  value={tag.rotate ?? 0}
                  onChange={(e) => setTag({ ...tag, rotate: Number(e.target.value) || undefined })}
                  className={field}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className={`h-10 border ${
                  tag.flip ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100' : 'border-white/10 text-white/70'
                } hover:bg-white/10 hover:text-white`}
                onClick={() => setTag({ ...tag, flip: tag.flip ? undefined : true })}
              >
                Flip
              </Button>
            </div>
            {tag.style !== 'skeletal' && (tag.rotate || tag.flip) && (
              <p className="text-[11px] text-white/40">
                Rotate and flip apply to skeletal drawings and to ring molecules; straight-chain structural and
                displayed drawings stay level.
              </p>
            )}

            <div className="rounded-lg border border-white/10 bg-black/25 p-3 min-h-[120px] flex items-center justify-center">
              {!tag.input.trim() ? (
                <span className="text-sm text-white/40">The drawing appears here as you type.</span>
              ) : (
                <Molecule
                  input={tag.input}
                  style={tag.style}
                  kind={tag.kind}
                  label={tag.label}
                  rotate={tag.rotate}
                  flip={tag.flip}
                />
              )}
            </div>
            {result?.note && <p className="text-[11px] text-amber-200/80">{result.note}</p>}
            {canInsert && (
              <p className="font-mono text-[11px] text-white/40 break-all">{formatMolTag(tag)}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canInsert}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
              onClick={apply}
            >
              {editing >= 0 ? 'Update molecule' : 'Insert molecule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
