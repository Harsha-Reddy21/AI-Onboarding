'use client';

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Code block with copy button
function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!match) {
    // Inline code
    return (
      <code
        className={cn(
          'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Code block
  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between bg-zinc-800 dark:bg-zinc-900 text-zinc-400 px-4 py-2 text-xs rounded-t-lg border-b border-zinc-700">
        <span className="font-medium">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        style={oneDark as { [key: string]: CSSProperties }}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: '0.875rem',
          },
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose-custom', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children, ...props }) => (
            <h1
              className="scroll-m-20 text-3xl font-bold tracking-tight lg:text-4xl mb-4 mt-8 first:mt-0 pb-2 border-b"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8 mb-4 pb-2 border-b first:mt-0"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3"
              {...props}
            >
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4
              className="scroll-m-20 text-lg font-semibold tracking-tight mt-5 mb-2"
              {...props}
            >
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5
              className="scroll-m-20 text-base font-semibold tracking-tight mt-4 mb-2"
              {...props}
            >
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6
              className="scroll-m-20 text-sm font-semibold tracking-tight mt-4 mb-2"
              {...props}
            >
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children, ...props }) => (
            <p className="leading-7 [&:not(:first-child)]:mt-4" {...props}>
              {children}
            </p>
          ),

          // Lists
          ul: ({ children, ...props }) => (
            <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-7" {...props}>
              {children}
            </li>
          ),

          // Blockquote
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="mt-4 border-l-4 border-primary/50 bg-muted/50 pl-4 py-2 italic text-muted-foreground rounded-r-md"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: (props) => <hr className="my-6 border-border" {...props} />,

          // Links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          // Strong/Bold
          strong: ({ children, ...props }) => (
            <strong className="font-semibold" {...props}>
              {children}
            </strong>
          ),

          // Emphasis/Italic
          em: ({ children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),

          // Code
          code: CodeBlock,

          // Pre (wrapper for code blocks)
          pre: ({ children }) => (
            <div>{children}</div>
          ),

          // Tables
          table: ({ children, ...props }) => (
            <div className="my-6 w-full overflow-auto rounded-lg border">
              <table className="w-full" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="[&_tr:last-child]:border-0" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr
              className="border-b transition-colors hover:bg-muted/50"
              {...props}
            >
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th
              className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground [&:has([role=checkbox])]:pr-0"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="p-4 align-middle [&:has([role=checkbox])]:pr-0"
              {...props}
            >
              {children}
            </td>
          ),

          // Images
          img: ({ src, alt, ...props }) => (
            <span className="block my-6">
              <img
                src={src}
                alt={alt || ''}
                className="rounded-lg border shadow-sm max-w-full h-auto"
                loading="lazy"
                {...props}
              />
              {alt && (
                <span className="block text-center text-sm text-muted-foreground mt-2">
                  {alt}
                </span>
              )}
            </span>
          ),

          // Delete/Strikethrough
          del: ({ children, ...props }) => (
            <del className="line-through text-muted-foreground" {...props}>
              {children}
            </del>
          ),

          // Task list items (GFM)
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

