import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PillTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

export function PillTabs({ value, onValueChange, options }: PillTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-auto">
      <TabsList className="bg-transparent border-none p-0 gap-2">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="rounded-full px-6 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--violet)] data-[state=active]:to-[var(--magenta)] data-[state=inactive]:bg-[var(--neon-card)] data-[state=inactive]:text-[var(--text-dim)] data-[state=active]:text-white focus:outline-none focus:ring-2 focus:ring-[var(--violet)] focus:ring-offset-2 focus:ring-offset-[#060914]"
            style={{
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--neon-border)',
              boxShadow: value === option.value ? '0 0 20px rgba(154,91,255,0.3)' : 'none',
            }}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
