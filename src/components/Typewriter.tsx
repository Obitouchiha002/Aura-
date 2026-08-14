import React, { useEffect, useState } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 40, delay = 0, className }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let currentText = '';
    setDisplayedText('');
    setIsDone(false);

    let interval: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      let index = 0;
      if (text.length > 0) {
        currentText += text[0];
        setDisplayedText(currentText);
        index++;
      }
      interval = setInterval(() => {
        if (index < text.length) {
          currentText += text[index];
          setDisplayedText(currentText);
          index++;
        } else {
          clearInterval(interval);
          setIsDone(true);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, delay]);

  return (
    <div className={className}>
      {displayedText}
      {/* CSS, not a JS animation: a caret that blinks forever should not cost
          a render loop. */}
      {!isDone && (
        <span
          className="inline-block w-[2px] h-[1em] bg-aura-red ml-1 align-middle"
          style={{ animation: 'blink 0.8s linear infinite' }}
        />
      )}
    </div>
  );
};
