import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GameMode } from '@/types/gameMode';

interface GameModeSelectorProps {
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
}

const GameModeSelector: React.FC<GameModeSelectorProps> = ({ onSelectMode, onBack }) => {
  const modes: {
    id: GameMode;
    title: string;
    description: string;
    syllabus: string;
    difficulty: string;
    progression: string;
    color: string;
    gradient: string;
    icon: string;
    features: string[];
  }[] = [
    {
      id: 'A1-Only',
      title: 'A1-Only Mode',
      description: 'Pure AS Level Mathematics progression',
      syllabus: 'AS Level (A1)',
      difficulty: 'Foundation → Advanced A1',
      progression: 'Bronze → Pocket Calculator',
      color: 'hsl(210 100% 60%)',
      gradient: 'linear-gradient(135deg, hsl(210 100% 60%), hsl(210 100% 70%))',
      icon: '📐',
      features: [
        'Algebra & Functions foundations',
        'Coordinate Geometry & Trigonometry',
        'Differentiation & Integration basics',
        'Sequences, Series & Binomial',
        'A★-level problem solving'
      ]
    },
    {
      id: 'A2-Only',
      title: 'A2-Only Mode',
      description: 'Advanced A Level content exclusively',
      syllabus: 'A2 Level Only',
      difficulty: 'A2 Foundation → A★ Mastery',
      progression: 'Bronze → Pocket Calculator',
      color: 'hsl(280 100% 65%)',
      gradient: 'linear-gradient(135deg, hsl(280 100% 65%), hsl(320 100% 75%))',
      icon: '🧮',
      features: [
        'Advanced Functions & Compositions',
        'Partial Fractions & Complex Calculus',
        'Differential Equations',
        '3D Vectors & Parametric Curves',
        'Multi-technique integrations'
      ]
    },
    {
      id: 'All-Maths',
      title: 'All-Maths Mode',
      description: 'Complete A Level journey (A1 → A2)',
      syllabus: 'Full A Level',
      difficulty: 'A1 Basics → A★ Composites',
      progression: 'A1 Foundation → A1+A2 Mastery',
      color: 'hsl(45 100% 55%)',
      gradient: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(60 100% 65%))',
      icon: '🎯',
      features: [
        'Progressive A1 → A2 transition',
        'Comprehensive topic coverage',
        'Cross-topic A★ challenges',
        'Complete CAIE preparation',
        'Ultimate mathematics mastery'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-primary/5 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          >
            ← Back to Dashboard
          </Button>
          
          <h1 className="text-4xl font-bold text-primary mb-4">
            Choose Your Mathematics Journey
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select a game mode tailored to your learning goals. Each mode offers a unique progression 
            through CAIE Mathematics with 200+ questions per rank.
          </p>
        </motion.div>

        {/* Game Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {modes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="h-full cyber-card border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                onClick={() => onSelectMode(mode.id)}
              >
                <CardHeader className="text-center pb-3">
                  <div className="text-6xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {mode.icon}
                  </div>
                  <CardTitle 
                    className="text-xl font-bold group-hover:text-primary transition-colors"
                    style={{ color: mode.color }}
                  >
                    {mode.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {mode.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Mode Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Syllabus:</span>
                      <Badge variant="secondary">{mode.syllabus}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Difficulty:</span>
                      <span className="font-medium">{mode.difficulty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Progression:</span>
                      <span className="font-medium">{mode.progression}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Key Features:</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {mode.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Select Button */}
                  <Button 
                    className="w-full group-hover:scale-105 transition-transform duration-300"
                    style={{ 
                      background: mode.gradient,
                      border: 'none'
                    }}
                  >
                    Start {mode.title}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Rank Progression Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="cyber-card p-6 border border-primary/20"
        >
          <h2 className="text-2xl font-bold text-primary mb-4 text-center">
            Ranking System Overview
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { tier: 'Bronze', emoji: '🥉', color: 'hsl(30 50% 50%)', description: '0-299 pts' },
              { tier: 'Silver', emoji: '🥈', color: 'hsl(0 0% 70%)', description: '300-599 pts' },
              { tier: 'Gold', emoji: '🥇', color: 'hsl(45 100% 60%)', description: '600-899 pts' },
              { tier: 'Diamond', emoji: '💎', color: 'hsl(180 100% 70%)', description: '900-1199 pts' },
              { tier: 'Unbeatable', emoji: '🔥', color: 'hsl(0 100% 65%)', description: '1200-1499 pts' },
              { tier: 'Pocket Calculator', emoji: '🧮', color: 'hsl(280 100% 80%)', description: 'Top 1,000 Elite' },
            ].map((rank) => (
              <div key={rank.tier} className="text-center p-3 rounded-lg bg-background/50">
                <div className="text-3xl mb-2">{rank.emoji}</div>
                <div className="font-bold text-sm" style={{ color: rank.color }}>
                  {rank.tier}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {rank.description}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-primary">🎯 Promotion Rule:</strong> Achieve ≥80% accuracy to advance to the next rank
            </p>
            <p>
              <strong className="text-primary">🏆 Pocket Calculator:</strong> Elite rank limited to top 1,000 players per mode
            </p>
            <p>
              <strong className="text-primary">📚 Questions:</strong> 200+ unique questions per rank, sourced from CAIE past papers
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GameModeSelector;