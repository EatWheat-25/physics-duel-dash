import React from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCharacter } from '@/hooks/useCharacter';

const CharacterSelection: React.FC = () => {
  const { 
    characters, 
    selectedCharacter, 
    selectCharacter, 
    isCharacterSelectionOpen, 
    setCharacterSelectionOpen 
  } = useCharacter();

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={isCharacterSelectionOpen} onOpenChange={setCharacterSelectionOpen}>
      <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-md border border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Choose Your Character
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
          {characters.map((character, index) => (
            <motion.div
              key={character.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                selectedCharacter?.id === character.id
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              } ${!character.unlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => character.unlocked && selectCharacter(character.id)}
            >
              <div className="relative">
                <img
                  src={character.avatar}
                  alt={character.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <Badge 
                  className={`absolute top-2 right-2 ${getRarityColor(character.rarity)} text-white`}
                >
                  {character.rarity}
                </Badge>
                {!character.unlocked && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">LOCKED</span>
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-center mb-2">{character.name}</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {character.description}
              </p>
              
              {selectedCharacter?.id === character.id && (
                <div className="text-center">
                  <Badge variant="secondary">Selected</Badge>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <Button 
            onClick={() => setCharacterSelectionOpen(false)}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          >
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CharacterSelection;