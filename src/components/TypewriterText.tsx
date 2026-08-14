import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from './markdownComponents';

interface TypewriterTextProps {
  text: string;
  animate?: boolean;
  speed?: number;
  markdown?: boolean;
  /** Fired once the full text is on screen. */
  onDone?: () => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, animate = true, speed = 25, markdown = true, onDone }) => {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);
  const containerRef = useRef<HTMLDivElement>(null);

  const targetFrames = speed < 20 ? 30 : 50; 
  const step = animate ? Math.max(1, Math.ceil(text.length / targetFrames)) : text.length;

  // Held in a ref so a caller passing an inline arrow does not restart the
  // animation on every render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      onDoneRef.current?.();
      return;
    }

    setDisplayedText('');
    let currentIndex = 0;
    
    const tickSpeed = Math.max(10, Math.min(speed, 25)); 
    
    const interval = setInterval(() => {
      currentIndex += step;
      if (currentIndex >= text.length) {
        setDisplayedText(text);
        clearInterval(interval);
        onDoneRef.current?.();
      } else {
        setDisplayedText(text.slice(0, currentIndex));
      }
    }, tickSpeed);

    return () => clearInterval(interval);
  }, [text, animate, step]);

  useEffect(() => {
    if (!containerRef.current || !animate) return;
    let parent = containerRef.current.parentElement;
    let scrollContainer = null;
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
      if (distanceToBottom <= 120) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [displayedText, animate]);

  if (markdown) {
    return (
      <div ref={containerRef} className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayedText}
        </ReactMarkdown>
      </div>
    );
  }

  return <span ref={containerRef}>{displayedText}</span>;
};
