export interface Question {
  id: string;
  q: string;
  options: string[];
  answer: number;
  chapter: string;
  level: 'A1' | 'A2';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  level: 'A1' | 'A2';
  order: number;
  requiredRankPoints: number;
  icon: string;
  questions: Question[];
}

export interface PhysicsLevel {
  id: 'A1' | 'A2_ONLY' | 'A2';
  title: string;
  description: string;
  chapters: Chapter[];
}

// A1 Physics Chapters (AS Level) - Aligned with rank progression
export const A1_CHAPTERS: Chapter[] = [
  // Bronze 1: Chapters 1-2 (0 points)
  {
    id: 'mechanics-motion',
    title: 'Chapter 1: Motion in a Straight Line',
    description: 'Displacement, velocity, acceleration, equations of motion',
    level: 'A1',
    order: 1,
    requiredRankPoints: 0, // Bronze 1
    icon: '🏃',
    questions: [
      {
        id: 'ch1-1',
        q: "A particle moves in a circle of radius r with speed v. Its centripetal acceleration is:",
        options: ["v/r", "v²/r", "r/v²", "r/v"],
        answer: 1,
        chapter: 'mechanics-motion',
        level: 'A1',
        difficulty: 'medium'
      },
      {
        id: 'ch1-2',
        q: "Which quantity is scalar?",
        options: ["Velocity", "Displacement", "Force", "Speed"],
        answer: 3,
        chapter: 'mechanics-motion',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'forces-newtons-laws',
    title: 'Chapter 2: Forces & Newton\'s Laws',
    description: 'Force, mass, acceleration, Newton\'s three laws',
    level: 'A1',
    order: 2,
    requiredRankPoints: 0, // Bronze 1
    icon: '⚖️',
    questions: [
      {
        id: 'ch2-1',
        q: "SI unit of Force is:",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        answer: 1,
        chapter: 'forces-newtons-laws',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'ch2-2',
        q: "Newton's first law is also known as:",
        options: ["Law of acceleration", "Law of inertia", "Law of action-reaction", "Law of gravitation"],
        answer: 1,
        chapter: 'forces-newtons-laws',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Bronze 2: Chapter 3 (100 points)
  {
    id: 'work-energy-power',
    title: 'Chapter 3: Work, Energy & Power',
    description: 'Work-energy theorem, kinetic & potential energy, power',
    level: 'A1',
    order: 3,
    requiredRankPoints: 100, // Bronze 2
    icon: '⚡',
    questions: [
      {
        id: 'ch3-1',
        q: "Work done = ?",
        options: ["Force × Distance", "Mass × Velocity", "Energy × Time", "Power × Distance"],
        answer: 0,
        chapter: 'work-energy-power',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'ch3-2',
        q: "The formula for kinetic energy is:",
        options: ["mgh", "½mv²", "mv", "½mgh"],
        answer: 1,
        chapter: 'work-energy-power',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Bronze 3: Chapter 4 (200 points)
  {
    id: 'momentum-collisions',
    title: 'Chapter 4: Momentum & Collisions',
    description: 'Linear momentum, conservation laws, elastic & inelastic collisions',
    level: 'A1',
    order: 4,
    requiredRankPoints: 200, // Bronze 3
    icon: '💥',
    questions: [
      {
        id: 'ch4-1',
        q: "The unit of momentum is:",
        options: ["kg⋅m/s", "kg⋅m/s²", "N⋅s", "Both A and C"],
        answer: 3,
        chapter: 'momentum-collisions',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Silver 1: Chapter 5 (300 points)
  {
    id: 'circular-motion',
    title: 'Chapter 5: Circular Motion',
    description: 'Uniform circular motion, centripetal force, angular velocity',
    level: 'A1',
    order: 5,
    requiredRankPoints: 300, // Silver 1
    icon: '🌀',
    questions: [
      {
        id: 'ch5-1',
        q: "Centripetal acceleration is directed:",
        options: ["Tangent to the circle", "Away from center", "Towards center", "Perpendicular to motion"],
        answer: 2,
        chapter: 'circular-motion',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Silver 2: Chapter 6 (400 points)
  {
    id: 'oscillations',
    title: 'Chapter 6: Simple Harmonic Motion',
    description: 'SHM, period, frequency, amplitude, energy in oscillations',
    level: 'A1',
    order: 6,
    requiredRankPoints: 400, // Silver 2
    icon: '📳',
    questions: [
      {
        id: 'ch6-1',
        q: "The acceleration due to gravity on Earth is approximately:",
        options: ["9.8 m/s", "9.8 m/s²", "9.8 m²/s", "9.8 s/m²"],
        answer: 1,
        chapter: 'oscillations',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  // Silver 3: Chapter 7 (500 points)
  {
    id: 'waves',
    title: 'Chapter 7: Waves',
    description: 'Wave properties, interference, diffraction, standing waves',
    level: 'A1',
    order: 7,
    requiredRankPoints: 500, // Silver 3
    icon: '🌊',
    questions: [
      {
        id: 'ch7-1',
        q: "Wave speed equals:",
        options: ["frequency × wavelength", "frequency / wavelength", "wavelength / frequency", "amplitude × frequency"],
        answer: 0,
        chapter: 'waves',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Gold 1: Chapter 8 (600 points)
  {
    id: 'electricity-current',
    title: 'Chapter 8: Electric Current',
    description: 'Current, potential difference, resistance, Ohm\'s law',
    level: 'A1',
    order: 8,
    requiredRankPoints: 600, // Gold 1
    icon: '🔌',
    questions: [
      {
        id: 'ch8-1',
        q: "The unit of electric current is:",
        options: ["Volt", "Ampere", "Ohm", "Coulomb"],
        answer: 1,
        chapter: 'electricity-current',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'ch8-2',
        q: "Ohm's law states that:",
        options: ["V = IR", "V = I/R", "I = VR", "R = VI"],
        answer: 0,
        chapter: 'electricity-current',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Gold 2: Chapter 9 (700 points)
  {
    id: 'electric-circuits',
    title: 'Chapter 9: Electric Circuits',
    description: 'Series & parallel circuits, Kirchhoff\'s laws, power in circuits',
    level: 'A1',
    order: 9,
    requiredRankPoints: 700, // Gold 2
    icon: '🔗',
    questions: [
      {
        id: 'ch9-1',
        q: "In a series circuit, total resistance is:",
        options: ["Sum of individual resistances", "Product of resistances", "Average of resistances", "Minimum resistance"],
        answer: 0,
        chapter: 'electric-circuits',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  // Gold 3: Chapter 10 (800 points)
  {
    id: 'magnetic-fields',
    title: 'Chapter 10: Magnetic Fields',
    description: 'Magnetic fields, forces on current-carrying conductors, electromagnetic induction',
    level: 'A1',
    order: 10,
    requiredRankPoints: 800, // Gold 3
    icon: '🧲',
    questions: [
      {
        id: 'ch10-1',
        q: "The direction of magnetic force on a current-carrying conductor is given by:",
        options: ["Right-hand rule", "Left-hand rule", "Fleming's rule", "All of the above"],
        answer: 3,
        chapter: 'magnetic-fields',
        level: 'A1',
        difficulty: 'hard'
      }
    ]
  },
  // Platinum 1: Chapter 11 (900 points)
  {
    id: 'quantum-photoelectric',
    title: 'Chapter 11: Photoelectric Effect',
    description: 'Photons, photoelectric effect, wave-particle duality',
    level: 'A1',
    order: 11,
    requiredRankPoints: 900, // Platinum 1
    icon: '⚛️',
    questions: [
      {
        id: 'ch11-1',
        q: "The photoelectric effect demonstrates:",
        options: ["Wave nature of light", "Particle nature of light", "Both wave and particle nature", "Neither"],
        answer: 1,
        chapter: 'quantum-photoelectric',
        level: 'A1',
        difficulty: 'hard'
      }
    ]
  }
];

// A2 Physics Chapters (Additional A Level content)
export const A2_CHAPTERS: Chapter[] = [
  {
    id: 'thermodynamics',
    title: 'Thermodynamics',
    description: 'Heat engines, entropy, gas laws',
    level: 'A2',
    order: 6,
    requiredRankPoints: 600, // Silver 3
    icon: '🌡️',
    questions: [
      {
        id: 'thermo1-1',
        q: "Which of the following is a vector quantity?",
        options: ["Mass", "Temperature", "Displacement", "Speed"],
        answer: 2,
        chapter: 'thermodynamics',
        level: 'A2',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'quantum-physics',
    title: 'Quantum Physics',
    description: 'Photons, wave-particle duality, atomic structure',
    level: 'A2',
    order: 7,
    requiredRankPoints: 1200, // Diamond 1
    icon: '⚛️',
    questions: []
  },
  {
    id: 'nuclear-physics',
    title: 'Nuclear Physics',
    description: 'Radioactivity, nuclear reactions, decay',
    level: 'A2',
    order: 8,
    requiredRankPoints: 1400, // Diamond 3
    icon: '☢️',
    questions: []
  }
];

export const PHYSICS_LEVELS: PhysicsLevel[] = [
  {
    id: 'A1',
    title: 'A1 Physics (AS Level)',
    description: 'Foundation physics concepts for AS Level',
    chapters: A1_CHAPTERS
  },
  {
    id: 'A2_ONLY',
    title: 'A2 Physics Only',
    description: 'Advanced A2 Level physics content only',
    chapters: A2_CHAPTERS
  },
  {
    id: 'A2',
    title: 'A2 Physics (A Level Full)',
    description: 'Complete A Level physics including A1 + A2 content',
    chapters: [...A1_CHAPTERS, ...A2_CHAPTERS]
  }
];

export const getUnlockedChapters = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number): Chapter[] => {
  const physicsLevel = PHYSICS_LEVELS.find(l => l.id === level);
  if (!physicsLevel) return [];
  
  // For Diamond ranks (1200+ points), unlock ALL chapters
  if (currentPoints >= 1200) {
    return physicsLevel.chapters;
  }
  
  // For Platinum 2+ (1000+ points), mix and integrate earlier chapters
  if (currentPoints >= 1000) {
    return physicsLevel.chapters.filter(chapter => 
      currentPoints >= chapter.requiredRankPoints
    );
  }
  
  // Standard progression for Bronze to Platinum 1
  return physicsLevel.chapters.filter(chapter => 
    currentPoints >= chapter.requiredRankPoints
  );
};

export const getNewlyUnlockedChapters = (level: 'A1' | 'A2_ONLY' | 'A2', oldPoints: number, newPoints: number): Chapter[] => {
  const physicsLevel = PHYSICS_LEVELS.find(l => l.id === level);
  if (!physicsLevel) return [];
  
  const oldUnlocked = getUnlockedChapters(level, oldPoints);
  const newUnlocked = getUnlockedChapters(level, newPoints);
  
  return newUnlocked.filter(chapter => 
    !oldUnlocked.some(oldChapter => oldChapter.id === chapter.id)
  );
};

export const getQuestionsFromChapters = (chapters: Chapter[], count: number = 5): Question[] => {
  const allQuestions: Question[] = [];
  chapters.forEach(chapter => {
    allQuestions.push(...chapter.questions);
  });
  
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, allQuestions.length));
};

// Get questions based on rank progression (automatic chapter filtering)
export const getQuestionsByRank = (level: 'A1' | 'A2_ONLY' | 'A2', currentPoints: number, count: number = 5): Question[] => {
  const unlockedChapters = getUnlockedChapters(level, currentPoints);
  return getQuestionsFromChapters(unlockedChapters, count);
};