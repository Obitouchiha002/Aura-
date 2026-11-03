import React from 'react';
import type { Components } from 'react-markdown';
import { Mermaid } from './Mermaid';
import { RoomAside } from './RoomAside';

/**
 * Shared react-markdown renderers.
 *
 * `code` is the only override, and it carries two conventions. A ```mermaid
 * fence becomes a rendered diagram, which is what makes "draw me a flowchart"
 * produce a flowchart. A ```room fence becomes the Council's side
 * conversation, folded away until someone opens it.
 *
 * Both ride on a fence rather than on HTML because react-markdown escapes raw
 * HTML, and the plugin that would stop it escaping would also let any model
 * reply put arbitrary markup into the page.
 *
 * Everything else falls through to plain HTML, styled by `.markdown-body`.
 */
export const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    const source = String(children ?? '');

    if (language === 'mermaid') {
      return <Mermaid chart={source.replace(/\n$/, '')} />;
    }

    if (language === 'room') {
      return <RoomAside source={source.replace(/\n$/, '')} />;
    }

    return <code className={className} {...props}>{children}</code>;
  },
};
