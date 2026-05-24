import React, { useState, useEffect, useRef } from 'react';

interface TypewriterTextProps {
  text: string;
  animate?: boolean;
  speed?: number;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, animate = true, speed = 25 }) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Target completing the typing dynamically, speed dictates frame delay
  // For long text, take bigger steps to finish faster. Target ~0.5s (30-40 frames)
  const targetFrames = speed < 20 ? 30 : 50; 
  const step = animate ? Math.max(1, Math.ceil(text.length / targetFrames)) : text.length;

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let currentIndex = 0;
    
    // Fast interval for typing feel, use speed prop
    const tickSpeed = Math.max(10, Math.min(speed, 25)); 
    
    const interval = setInterval(() => {
      currentIndex += step;
      if (currentIndex >= text.length) {
        setDisplayedText(text);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, currentIndex));
      }
    }, tickSpeed);

    return () => clearInterval(interval);
  }, [text, animate, step]);

  // Handle smart auto-scroll only when user is already near the bottom
  useEffect(() => {
    if (!containerRef.current || !animate) return;

    // Find the nearest ancestor container that is scrollable
    let parent = containerRef.current.parentElement;
    let scrollContainer: HTMLElement | null = null;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (scrollContainer) {
      const distanceToBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      // If we are close to the bottom (e.g., within 120px), auto-scroll to the bottom.
      // If the user has scrolled up to read earlier messages, distanceToBottom will be larger,
      // so we leave their scroll position completely untouched.
      if (distanceToBottom <= 120) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [displayedText, animate]);

  return <span ref={containerRef}>{displayedText}</span>;
};
