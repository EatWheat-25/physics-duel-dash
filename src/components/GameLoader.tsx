import './GameLoader.css';

interface GameLoaderProps {
  text?: string;
}

export function GameLoader({ text = 'loading' }: GameLoaderProps) {
  return (
    <div className="game-loader">
      <span className="game-loader-text">{text}</span>
      <span className="game-load"></span>
    </div>
  );
}




