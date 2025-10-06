-- Insert 10 CAIE-style A-Level Mathematics questions

-- Question 1: Quadratic Equations (Bronze/A1/Easy)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Solve the quadratic equation',
  'math',
  'quadratic-equations',
  'A1',
  'easy',
  'Bronze',
  'Solve the equation x² - 5x + 6 = 0',
  2,
  '[
    {
      "id": "step-1",
      "question": "Factorise x² - 5x + 6",
      "options": ["(x - 2)(x - 3)", "(x - 1)(x - 6)", "(x + 2)(x + 3)", "(x - 5)(x + 1)"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "We need two numbers that multiply to 6 and add to -5. These are -2 and -3, giving us (x - 2)(x - 3)."
    },
    {
      "id": "step-2",
      "question": "What are the solutions to the equation?",
      "options": ["x = 2 or x = 3", "x = 1 or x = 6", "x = -2 or x = -3", "x = 5 or x = -1"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Setting each factor equal to zero: (x - 2) = 0 gives x = 2, and (x - 3) = 0 gives x = 3."
    }
  ]'::jsonb,
  ARRAY['quadratics', 'factorisation', 'algebra']
);

-- Question 2: Differentiation (Silver/A1/Medium)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Differentiate polynomial function',
  'math',
  'differentiation',
  'A1',
  'medium',
  'Silver',
  'Find dy/dx when y = 3x⁴ - 2x² + 5x - 7',
  3,
  '[
    {
      "id": "step-1",
      "question": "Differentiate the term 3x⁴",
      "options": ["12x³", "3x³", "12x⁴", "4x³"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Using the power rule: d/dx(3x⁴) = 3 × 4x³ = 12x³"
    },
    {
      "id": "step-2",
      "question": "Differentiate the term -2x²",
      "options": ["-4x", "-2x", "-4x²", "-2"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Using the power rule: d/dx(-2x²) = -2 × 2x = -4x"
    },
    {
      "id": "step-3",
      "question": "What is the complete derivative dy/dx?",
      "options": ["12x³ - 4x + 5", "12x³ - 2x + 5", "12x³ - 4x - 7", "3x³ - 4x + 5"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Combining all terms: 12x³ - 4x + 5. The constant -7 differentiates to 0."
    }
  ]'::jsonb,
  ARRAY['differentiation', 'calculus', 'polynomials']
);

-- Question 3: Integration (Gold/A1/Medium)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Evaluate definite integral',
  'math',
  'integration',
  'A1',
  'medium',
  'Gold',
  'Evaluate ∫₁³ (2x + 3) dx',
  4,
  '[
    {
      "id": "step-1",
      "question": "Find the indefinite integral of 2x + 3",
      "options": ["x² + 3x + c", "2x² + 3x + c", "x² + 3 + c", "x³ + 3x + c"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "∫(2x + 3)dx = x² + 3x + c, using the power rule for integration."
    },
    {
      "id": "step-2",
      "question": "Substitute the upper limit x = 3",
      "options": ["18", "21", "15", "12"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "At x = 3: (3)² + 3(3) = 9 + 9 = 18"
    },
    {
      "id": "step-3",
      "question": "Substitute the lower limit x = 1",
      "options": ["4", "3", "5", "2"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "At x = 1: (1)² + 3(1) = 1 + 3 = 4"
    },
    {
      "id": "step-4",
      "question": "Calculate the final answer",
      "options": ["14", "18", "22", "10"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Definite integral = upper limit - lower limit = 18 - 4 = 14"
    }
  ]'::jsonb,
  ARRAY['integration', 'definite integrals', 'calculus']
);

-- Question 4: Trigonometry (Silver/A1/Medium)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Solve trigonometric equation',
  'math',
  'trigonometry',
  'A1',
  'medium',
  'Silver',
  'Solve 2sin(x) = 1 for 0° ≤ x ≤ 360°',
  3,
  '[
    {
      "id": "step-1",
      "question": "Rearrange to find sin(x)",
      "options": ["sin(x) = 0.5", "sin(x) = 2", "sin(x) = 1", "sin(x) = 0.25"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Dividing both sides by 2: sin(x) = 1/2 = 0.5"
    },
    {
      "id": "step-2",
      "question": "Find the first solution in the range",
      "options": ["30°", "60°", "45°", "90°"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "The principal value where sin(x) = 0.5 is x = 30°"
    },
    {
      "id": "step-3",
      "question": "Find the second solution in the range",
      "options": ["150°", "120°", "210°", "330°"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "The second solution is x = 180° - 30° = 150° (sine is positive in 2nd quadrant)"
    }
  ]'::jsonb,
  ARRAY['trigonometry', 'equations', 'sine']
);

-- Question 5: Vectors (Diamond/A2/Hard)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Vector scalar product',
  'math',
  'vectors',
  'A2',
  'hard',
  'Diamond',
  'Given vectors a = 2i + 3j - k and b = i - 2j + 4k, find the angle θ between them',
  5,
  '[
    {
      "id": "step-1",
      "question": "Calculate a · b (scalar product)",
      "options": ["-8", "-4", "0", "8"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "a · b = (2)(1) + (3)(-2) + (-1)(4) = 2 - 6 - 4 = -8"
    },
    {
      "id": "step-2",
      "question": "Calculate |a| (magnitude of a)",
      "options": ["√14", "√10", "√6", "√18"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "|a| = √(2² + 3² + (-1)²) = √(4 + 9 + 1) = √14"
    },
    {
      "id": "step-3",
      "question": "Calculate |b| (magnitude of b)",
      "options": ["√21", "√17", "√19", "√15"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "|b| = √(1² + (-2)² + 4²) = √(1 + 4 + 16) = √21"
    },
    {
      "id": "step-4",
      "question": "Find cos(θ) using the formula a · b = |a||b|cos(θ)",
      "options": ["-8/(√14 × √21)", "8/(√14 × √21)", "-8/√35", "8/14"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "cos(θ) = (a · b)/(|a||b|) = -8/(√14 × √21)"
    },
    {
      "id": "step-5",
      "question": "Calculate θ (in degrees, to 1 d.p.)",
      "options": ["114.4°", "65.6°", "90.0°", "124.4°"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "θ = arccos(-8/(√294)) = arccos(-0.467) ≈ 114.4°"
    }
  ]'::jsonb,
  ARRAY['vectors', 'scalar product', 'angles']
);

-- Question 6: Parametric Equations (Gold/A2/Hard)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Parametric differentiation',
  'math',
  'differentiation',
  'A2',
  'hard',
  'Gold',
  'A curve is defined parametrically by x = t² + 1, y = 2t³. Find dy/dx at t = 2',
  4,
  '[
    {
      "id": "step-1",
      "question": "Find dx/dt",
      "options": ["2t", "2t²", "t²", "2"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Differentiating x = t² + 1 with respect to t: dx/dt = 2t"
    },
    {
      "id": "step-2",
      "question": "Find dy/dt",
      "options": ["6t²", "2t²", "6t³", "3t²"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Differentiating y = 2t³ with respect to t: dy/dt = 6t²"
    },
    {
      "id": "step-3",
      "question": "Express dy/dx in terms of t",
      "options": ["3t", "6t", "3t²/2", "6t²/2t"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "dy/dx = (dy/dt)/(dx/dt) = 6t²/2t = 3t"
    },
    {
      "id": "step-4",
      "question": "Evaluate dy/dx at t = 2",
      "options": ["6", "12", "3", "4"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Substituting t = 2 into dy/dx = 3t gives 3(2) = 6"
    }
  ]'::jsonb,
  ARRAY['parametric equations', 'differentiation', 'calculus']
);

-- Question 7: Binomial Expansion (Bronze/A1/Easy)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Binomial expansion',
  'math',
  'algebra',
  'A1',
  'easy',
  'Bronze',
  'Find the coefficient of x² in the expansion of (2 + x)⁴',
  2,
  '[
    {
      "id": "step-1",
      "question": "Identify the binomial coefficient for x² term",
      "options": ["⁴C₂ = 6", "⁴C₂ = 4", "⁴C₃ = 4", "⁴C₁ = 4"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "For x² in (2 + x)⁴, we need ⁴C₂ = 4!/(2!2!) = 6"
    },
    {
      "id": "step-2",
      "question": "Calculate the complete coefficient",
      "options": ["24", "12", "48", "6"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Coefficient = ⁴C₂ × 2² × 1 = 6 × 4 = 24"
    }
  ]'::jsonb,
  ARRAY['binomial theorem', 'algebra', 'expansion']
);

-- Question 8: Logarithms (Silver/A2/Medium)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Solve logarithmic equation',
  'math',
  'algebra',
  'A2',
  'medium',
  'Silver',
  'Solve log₂(x) + log₂(x - 3) = 2',
  3,
  '[
    {
      "id": "step-1",
      "question": "Combine the logarithms using log rules",
      "options": ["log₂(x(x - 3)) = 2", "log₂(x + x - 3) = 2", "log₂(x - 3x) = 2", "log₂(x/(x - 3)) = 2"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "Using log(a) + log(b) = log(ab): log₂(x) + log₂(x - 3) = log₂(x(x - 3))"
    },
    {
      "id": "step-2",
      "question": "Convert to exponential form",
      "options": ["x(x - 3) = 4", "x(x - 3) = 2", "x - 3 = 4", "x² - 3 = 4"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "If log₂(y) = 2, then y = 2² = 4, so x(x - 3) = 4"
    },
    {
      "id": "step-3",
      "question": "Solve the quadratic equation x² - 3x - 4 = 0",
      "options": ["x = 4", "x = -1", "x = 3", "x = 2"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "x² - 3x - 4 = 0 factorises to (x - 4)(x + 1) = 0, giving x = 4 or x = -1. Since log requires x > 0 and x > 3, x = 4."
    }
  ]'::jsonb,
  ARRAY['logarithms', 'algebra', 'equations']
);

-- Question 9: Sequences (Silver/A2/Easy)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Arithmetic sequence sum',
  'math',
  'sequences',
  'A2',
  'easy',
  'Silver',
  'Find the sum of the first 20 terms of the arithmetic sequence 3, 7, 11, 15, ...',
  3,
  '[
    {
      "id": "step-1",
      "question": "Identify the first term (a) and common difference (d)",
      "options": ["a = 3, d = 4", "a = 3, d = 3", "a = 7, d = 4", "a = 3, d = 7"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "First term a = 3, common difference d = 7 - 3 = 4"
    },
    {
      "id": "step-2",
      "question": "Find the 20th term using aₙ = a + (n-1)d",
      "options": ["79", "83", "76", "80"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "a₂₀ = 3 + (20-1)×4 = 3 + 76 = 79"
    },
    {
      "id": "step-3",
      "question": "Calculate S₂₀ using Sₙ = n/2(a + l)",
      "options": ["820", "800", "840", "780"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "S₂₀ = 20/2 × (3 + 79) = 10 × 82 = 820"
    }
  ]'::jsonb,
  ARRAY['sequences', 'arithmetic progression', 'series']
);

-- Question 10: Complex Numbers (Diamond/A2/Hard)
INSERT INTO questions (title, subject, chapter, level, difficulty, rank_tier, question_text, total_marks, steps, topic_tags)
VALUES (
  'Complex number operations',
  'math',
  'complex-numbers',
  'A2',
  'hard',
  'Diamond',
  'Express (3 + 4i)/(1 - 2i) in the form a + bi',
  5,
  '[
    {
      "id": "step-1",
      "question": "Identify the conjugate of the denominator",
      "options": ["1 + 2i", "1 - 2i", "-1 + 2i", "-1 - 2i"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "The conjugate of (1 - 2i) is (1 + 2i)"
    },
    {
      "id": "step-2",
      "question": "Multiply numerator by the conjugate",
      "options": ["(3 + 4i)(1 + 2i) = -5 + 10i", "(3 + 4i)(1 + 2i) = 3 + 10i + 8i²", "(3 + 4i)(1 + 2i) = 11 + 10i", "(3 + 4i)(1 + 2i) = 3 + 6i + 4i + 8i²"],
      "correctAnswer": 3,
      "marks": 1,
      "explanation": "Expanding: (3 + 4i)(1 + 2i) = 3 + 6i + 4i + 8i²"
    },
    {
      "id": "step-3",
      "question": "Simplify the numerator (remember i² = -1)",
      "options": ["-5 + 10i", "11 + 10i", "3 + 10i", "-5 - 10i"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "3 + 6i + 4i + 8(-1) = 3 + 10i - 8 = -5 + 10i"
    },
    {
      "id": "step-4",
      "question": "Calculate the denominator (1 - 2i)(1 + 2i)",
      "options": ["5", "3", "1", "-3"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "(1 - 2i)(1 + 2i) = 1² - (2i)² = 1 - 4i² = 1 + 4 = 5"
    },
    {
      "id": "step-5",
      "question": "Express in the form a + bi",
      "options": ["-1 + 2i", "1 - 2i", "-5/5 + 10i/5", "-1 - 2i"],
      "correctAnswer": 0,
      "marks": 1,
      "explanation": "(-5 + 10i)/5 = -1 + 2i"
    }
  ]'::jsonb,
  ARRAY['complex numbers', 'algebra', 'conjugates']
);