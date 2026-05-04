import React, { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  animate?: boolean;
  speed?: number;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, animate = true, speed = 25 }) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
      }
      
      // Auto-scroll logic if needed
      const scrollableDiv = document.querySelector('.overflow-y-auto');
      if (scrollableDiv) {
        const isNearBottom = scrollableDiv.scrollHeight - scrollableDiv.scrollTop - scrollableDiv.clientHeight <= 150;
        if (isNearBottom) {
          scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        }
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, animate, speed]);

  return <>{displayedText}</>;
};
