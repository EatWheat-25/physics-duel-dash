export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Ruby';

export interface RankColors {
  outline: string;
  glow: string;
  innerBorder: string;
}

export function rankColor(tier: RankTier): RankColors {
  const colorMap: Record<RankTier, { base: string; glow: string; inner: string }> = {
    Bronze: { base: '#8A6B4C', glow: 'rgba(138, 107, 76, 0.4)', inner: '#6B5338' },
    Silver: { base: '#C0C0C0', glow: 'rgba(192, 192, 192, 0.4)', inner: '#9A9A9A' },
    Gold: { base: '#F5C542', glow: 'rgba(245, 197, 66, 0.4)', inner: '#C9A035' },
    Platinum: { base: '#9B8CFF', glow: 'rgba(155, 140, 255, 0.4)', inner: '#7A6ACC' },
    Diamond: { base: '#5AD1FF', glow: 'rgba(90, 209, 255, 0.4)', inner: '#3BA8CC' },
    Ruby: { base: '#FF4A4A', glow: 'rgba(255, 74, 74, 0.45)', inner: '#CC3030' },
  };

  const colors = colorMap[tier] || colorMap.Bronze;
  return {
    outline: colors.base,
    glow: colors.glow,
    innerBorder: colors.inner,
  };
}
