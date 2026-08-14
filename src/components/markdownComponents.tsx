import React from 'react';
import type { Components } from 'react-markdown';
import { Mermaid } from './Mermaid';

/**
 * Shared react-markdown renderers.
 *
 * The only override is `code`: a ```mermaid fence becomes a rendered diagram
 * instead of a wall of syntax, which is what makes "draw me a flowchart"
 * actually produce a flowchart. Everything else falls through to plain HTML
 * and is styled by `.markdown-body` in index.css.
 */
export const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    const source = String(children ?? '');

    if (language === 'mermaid') {
      return <Mermaid chart={source.replace(/\n$/, '')} />;
    }

    return <code className={className} {...props}>{children}</code>;
  },
};
