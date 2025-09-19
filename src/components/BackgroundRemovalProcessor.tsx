import React, { useEffect, useState } from 'react';
import { removeBackground, loadImage } from '@/utils/backgroundRemoval';
import animeCharacterOriginal from '@/assets/characters/anime-character.png';

const BackgroundRemovalProcessor: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    const processImage = async () => {
      if (processed || processing) return;
      
      setProcessing(true);
      try {
        // Load the original image
        const response = await fetch(animeCharacterOriginal);
        const blob = await response.blob();
        const imageElement = await loadImage(blob);
        
        // Remove background
        const processedBlob = await removeBackground(imageElement);
        
        // Create download link (for development - in production you'd save this properly)
        const url = URL.createObjectURL(processedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'anime-character-transparent.png';
        link.click();
        
        setProcessed(true);
        console.log('Background removal completed!');
      } catch (error) {
        console.error('Background removal failed:', error);
      } finally {
        setProcessing(false);
      }
    };

    // Only process once when component mounts
    processImage();
  }, []);

  if (processing) {
    return (
      <div className="fixed top-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-4 z-50">
        <p className="text-sm text-foreground">Processing character image...</p>
        <div className="w-full bg-secondary rounded-full h-2 mt-2">
          <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    );
  }

  return null;
};

export default BackgroundRemovalProcessor;