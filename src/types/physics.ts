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
  id: 'A1' | 'A2';
  title: string;
  description: string;
  chapters: Chapter[];
}

// A1 Physics Chapters (AS Level)
export const A1_CHAPTERS: Chapter[] = [
  {
    id: 'mechanics-1',
    title: 'Mechanics - Motion',
    description: 'Basic motion, velocity, acceleration',
    level: 'A1',
    order: 1,
    requiredRankPoints: 0, // Bronze 1
    icon: '🏃',
    questions: [
      {
        id: 'mech1-1',
        q: "A particle moves in a circle of radius r with speed v. Its centripetal acceleration is:",
        options: ["v/r", "v²/r", "r/v²", "r/v"],
        answer: 1,
        chapter: 'mechanics-1',
        level: 'A1',
        difficulty: 'medium'
      },
      {
        id: 'mech1-2',
        q: "Which quantity is scalar?",
        options: ["Velocity", "Displacement", "Force", "Speed"],
        answer: 3,
        chapter: 'mechanics-1',
        level: 'A1',
        difficulty: 'easy'
      }
    ]
  },
  {
    id: 'forces',
    title: 'Forces & Newton\'s Laws',
    description: 'Force, mass, acceleration relationships',
    level: 'A1',
    order: 2,
    requiredRankPoints: 200, // Bronze 3
    icon: '⚖️',
    questions: [
      {
        id: 'force1-1',
        q: "SI unit of Force is:",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        answer: 1,
        chapter: 'forces',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'force1-2',
        q: "Newton's first law is also known as:",
        options: ["Law of acceleration", "Law of inertia", "Law of action-reaction", "Law of gravitation"],
        answer: 1,
        chapter: 'forces',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'energy-work',
    title: 'Work, Energy & Power',
    description: 'Energy conservation, work-energy theorem',
    level: 'A1',
    order: 3,
    requiredRankPoints: 500, // Silver 2
    icon: '⚡',
    questions: [
      {
        id: 'energy1-1',
        q: "Work done = ?",
        options: ["Force × Distance", "Mass × Velocity", "Energy × Time", "Power × Distance"],
        answer: 0,
        chapter: 'energy-work',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'energy1-2',
        q: "The formula for kinetic energy is:",
        options: ["mgh", "½mv²", "mv", "½mgh"],
        answer: 1,
        chapter: 'energy-work',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'electricity-basics',
    title: 'Current & Voltage',
    description: 'Basic electrical concepts',
    level: 'A1',
    order: 4,
    requiredRankPoints: 800, // Gold 2
    icon: '🔌',
    questions: [
      {
        id: 'elec1-1',
        q: "The unit of electric current is:",
        options: ["Volt", "Ampere", "Ohm", "Coulomb"],
        answer: 1,
        chapter: 'electricity-basics',
        level: 'A1',
        difficulty: 'easy'
      },
      {
        id: 'elec1-2',
        q: "Ohm's law states that:",
        options: ["V = IR", "V = I/R", "I = VR", "R = VI"],
        answer: 0,
        chapter: 'electricity-basics',
        level: 'A1',
        difficulty: 'medium'
      }
    ]
  },
  {
    id: 'waves-basics',
    title: 'Waves & Oscillations',
    description: 'Wave properties, simple harmonic motion',
    level: 'A1',
    order: 5,
    requiredRankPoints: 1100, // Platinum 2
    icon: '🌊',
    questions: [
      {
        id: 'wave1-1',
        q: "The acceleration due to gravity on Earth is approximately:",
        options: ["9.8 m/s", "9.8 m/s²", "9.8 m²/s", "9.8 s/m²"],
        answer: 1,
        chapter: 'waves-basics',
        level: 'A1',
        difficulty: 'easy'
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
    id: 'A2',
    title: 'A2 Physics (A Level Full)',
    description: 'Complete A Level physics including A1 + A2 content',
    chapters: [...A1_CHAPTERS, ...A2_CHAPTERS]
  }
];

export const getUnlockedChapters = (level: 'A1' | 'A2', currentPoints: number): Chapter[] => {
  const physicsLevel = PHYSICS_LEVELS.find(l => l.id === level);
  if (!physicsLevel) return [];
  
  return physicsLevel.chapters.filter(chapter => 
    currentPoints >= chapter.requiredRankPoints
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