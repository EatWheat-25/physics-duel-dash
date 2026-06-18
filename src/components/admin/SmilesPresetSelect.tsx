import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SMILES_PRESETS } from '@/lib/smilesPresets'

type Props = {
  onPick: (smiles: string) => void
  triggerClassName?: string
  nonce?: number
}

/**
 * Uncontrolled select: after each pick, parent can bump `nonce` to reset the trigger label.
 */
export function SmilesPresetSelect({ onPick, triggerClassName, nonce = 0 }: Props) {
  return (
    <Select
      key={nonce}
      onValueChange={(id) => {
        const p = SMILES_PRESETS.find((x) => x.id === id)
        if (p) onPick(p.smiles)
      }}
    >
      <SelectTrigger className={triggerClassName ?? 'h-8 w-[220px] bg-white/5 border-white/10 text-white text-xs'}>
        <SelectValue placeholder="Insert structure preset…" />
      </SelectTrigger>
      <SelectContent className="bg-gray-900 border-white/10 text-white max-h-[280px]">
        {SMILES_PRESETS.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
