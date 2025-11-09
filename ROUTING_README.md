# BattleNerds Routing & Subject Propagation

## Overview

The application uses a central hub card design with persistent subject selection (Physics/Maths) that propagates across routes via URL query parameters and localStorage.

## State Management

### Subject Store (Zustand)
- **Location**: `src/store/useSubjectStore.ts`
- **Storage Key**: `academy_ui`
- **Values**: `'physics' | 'maths'`
- **Persistence**: localStorage via Zustand persist middleware
- **Default**: `'physics'`

### Usage
```typescript
import { useSubjectStore } from '@/store/useSubjectStore';

const { subject, setSubject } = useSubjectStore();
```

## Routes & URL Structure

### Hub Routes (with subject parameter)
All routes that depend on subject selection include `?subject={subject}` in the URL:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Home` | Central hub card (vertically centered) |
| `/daily-challenge?subject={subject}` | `DailyChallenge` | Daily quantum challenge |
| `/study?subject={subject}` | `Study` | Structured learning path |
| `/battle/queue?subject={subject}` | `BattleQueue` | 1v1 matchmaking |
| `/modules?subject={subject}` | `Modules` | Browse all modules |
| `/challenges?subject={subject}` | `Challenges` | Challenge list |
| `/progression?subject={subject}` | `Progression` | Stats & rankings |

### Subject-Agnostic Routes
These routes do NOT include subject parameter:

| Route | Component | Description |
|-------|-----------|-------------|
| `/shop` | `Shop` | In-app purchases |
| `/auth` | `Auth` | Authentication |
| `/onboarding` | `Onboarding` | First-time user flow |

## Navigation Flow

### Subject Toggle (SegmentedSubject)
- Located in hub card header
- Updates Zustand store immediately
- Persisted to localStorage
- When navigating, subject parameter is automatically appended

### Bottom Navigation (BottomNav)
Persistent across all pages with 5 buttons:

1. **Modules** → `/modules?subject={subject}`
2. **Challenges** → `/challenges?subject={subject}`
3. **BATTLE!** (emphasized) → `/battle/queue?subject={subject}`
4. **Progression** → `/progression?subject={subject}`
5. **Shop** → `/shop` (no subject)

Active route is highlighted with glow and border.

### Hub Card Tiles
Three main action tiles in the hub:

1. **Daily Challenge** (gradient banner) → `/daily-challenge?subject={subject}`
2. **Study Mode** (blue tile) → `/study?subject={subject}`
3. **Battle Arena** (violet tile) → `/battle/queue?subject={subject}`

## Subject Persistence Behavior

### Scenario 1: User toggles subject
1. User clicks "Maths" in segmented control
2. Store updates to `'maths'`
3. localStorage saves preference
4. User navigates to Study Mode
5. URL becomes `/study?subject=maths`

### Scenario 2: Returning user
1. User loads `/` (home)
2. Store reads from localStorage
3. Subject selector shows last choice (e.g., "Maths")
4. All navigation includes correct subject

### Scenario 3: Direct URL access
1. User visits `/study?subject=physics` directly
2. Page reads `subject` from searchParams
3. Store state may differ (not auto-synced from URL)
4. Component displays Physics content

**Note**: URL is source of truth for page content; store is source of truth for navigation.

## Page Titles

Each route sets `document.title` in `useEffect`:

- Home: `"Choose Your Path | BattleNerds"`
- Daily Challenge: `"Daily Challenge | BattleNerds"`
- Study: `"Physics Study Mode | BattleNerds"` or `"Maths Study Mode | BattleNerds"`
- Battle Queue: `"1v1 Battle Arena | BattleNerds"`
- Modules: `"Modules | BattleNerds"`
- Challenges: `"Challenges | BattleNerds"`
- Progression: `"Progression | BattleNerds"`
- Shop: `"Shop | BattleNerds"`

## Component Structure

```
src/
├── routes/
│   ├── Home.tsx              # Central hub (vertically centered)
│   ├── DailyChallenge.tsx
│   ├── Study.tsx
│   ├── BattleQueue.tsx
│   ├── Modules.tsx
│   ├── Challenges.tsx
│   ├── Progression.tsx
│   └── Shop.tsx
├── components/
│   ├── HubCard.tsx           # Main hub card with tiles
│   ├── SegmentedSubject.tsx  # Physics/Maths toggle
│   ├── Tile.tsx              # Reusable action tile
│   ├── BottomNav.tsx         # Persistent bottom navbar
│   └── Starfield.tsx         # Animated background
└── store/
    └── useSubjectStore.ts    # Zustand store with persistence
```

## Accessibility

- All buttons are keyboard navigable (Tab, Shift+Tab)
- Enter/Space activates focused controls
- ARIA labels on all interactive elements
- Focus rings visible (violet glow)
- `aria-current="page"` on active nav items
- `role="radiogroup"` on subject toggle
- `role="navigation"` on bottom nav

## Animations

- Hub card: subtle float + 3D tilt on hover (respects `prefers-reduced-motion`)
- Daily Challenge tile: pulsing glow every 6s
- Tiles: scale on hover/press
- Route transitions: 150–200ms fade/scale
- Battle! button: continuous pulse (disabled if `prefers-reduced-motion`)

## Responsive Breakpoints

- **≥1280px**: Hub width 880–960px
- **768–1279px**: Hub width 88%
- **≤767px**: Stacked layout, compact nav

## Future Enhancements

- Sync URL subject param to store on mount
- Server-side subject preferences (Supabase)
- Deep linking with subject context
- Route guards for authenticated pages
