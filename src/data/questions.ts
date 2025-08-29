export interface Question {
  q: string;
  options: string[];
  answer: number;
}

export const physicsQuestions: Question[] = [
  {
    q: "A particle moves in a circle of radius r with speed v. Its centripetal acceleration is:",
    options: ["v/r", "v²/r", "r/v²", "r/v"],
    answer: 1,
  },
  {
    q: "SI unit of Force is:",
    options: ["Joule", "Newton", "Watt", "Pascal"],
    answer: 1,
  },
  {
    q: "Which quantity is scalar?",
    options: ["Velocity", "Displacement", "Force", "Speed"],
    answer: 3,
  },
  {
    q: "Work done = ?",
    options: ["Force × Distance", "Mass × Velocity", "Energy × Time", "Power × Distance"],
    answer: 0,
  },
  {
    q: "The unit of electric current is:",
    options: ["Volt", "Ampere", "Ohm", "Coulomb"],
    answer: 1,
  },
  {
    q: "Newton's first law is also known as:",
    options: ["Law of acceleration", "Law of inertia", "Law of action-reaction", "Law of gravitation"],
    answer: 1,
  },
  {
    q: "The acceleration due to gravity on Earth is approximately:",
    options: ["9.8 m/s", "9.8 m/s²", "9.8 m²/s", "9.8 s/m²"],
    answer: 1,
  },
  {
    q: "Which of the following is a vector quantity?",
    options: ["Mass", "Temperature", "Displacement", "Speed"],
    answer: 2,
  },
  {
    q: "The formula for kinetic energy is:",
    options: ["mgh", "½mv²", "mv", "½mgh"],
    answer: 1,
  },
  {
    q: "Ohm's law states that:",
    options: ["V = IR", "V = I/R", "I = VR", "R = VI"],
    answer: 0,
  }
];

export const getRandomQuestions = (count: number = 5): Question[] => {
  const shuffled = [...physicsQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, physicsQuestions.length));
};