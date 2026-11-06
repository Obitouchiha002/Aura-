import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from './Mermaid';
import { RoomAside } from './RoomAside';

/**
 * Shared react-markdown renderers.
 *
 * `code` carries two conventions. A ```mermaid fence becomes a rendered
 * diagram, which is what makes "draw me a flowchart" produce a flowchart. A
 * ```room fence becomes the Council's side conversation, folded away until
 * someone opens it.
 *
 * Both ride on a fence rather than on HTML because react-markdown escapes raw
 * HTML, and the plugin that would stop it escaping would also let any model
 * reply put arbitrary markup into the page.
 *
 * `pre` exists only to get out of their way: react-markdown wraps every fence
 * in one, and a <pre> is monospaced and does not wrap, so the room's prose
 * arrived as a clipped column of code. Those two fences render components,
 * not code, so they are unwrapped and style themselves.
 *
 * Everything else falls through to plain HTML, styled by `.markdown-body`.
 */
const RENDERED = /language-(room|mermaid)\b/;

export const markdownComponents: Components = {
  pre({ children, ...props }) {
    const first = React.Children.toArray(children)[0];
    const className = React.isValidElement<{ className?: string }>(first)
      ? first.props.className || ''
      : '';

    if (RENDERED.test(className)) return <>{children}</>;

    return <pre {...props}>{children}</pre>;
  },

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

/**
 * A rendered reply that does not re-render.
 *
 * Nothing in the chat screen is memoised and the composer's text lives in the
 * same component as the message list, so every keystroke re-rendered every
 * message — and the most expensive thing in a message is this: parsing the
 * whole of its markdown again, for a string that has not changed since it
 * arrived. In a long conversation that is the difference between typing and
 * watching yourself type.
 *
 * Memoised on the text alone. The renderers above are a module constant and
 * the plugin list is frozen below, so neither can go stale.
 */
const PLUGINS = [remarkGfm];

export const Markdown = React.memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={PLUGINS} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
