import React from 'react';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  // Parse paragraphs, headers, bullet points, and bold text cleanly
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (keyPrefix: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${keyPrefix}`} className="my-2 space-y-1.5 pl-5 list-disc text-[14px] leading-relaxed text-[#173d2b]">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (text: string): React.ReactNode => {
    // Process **bold** and *italic*
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const matchStr = match[0];
      if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-[#173d2b]">
            {matchStr.slice(2, -2)}
          </strong>
        );
      } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
        parts.push(
          <em key={match.index} className="italic">
            {matchStr.slice(1, -1)}
          </em>
        );
      } else if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
        parts.push(
          <code key={match.index} className="px-1.5 py-0.5 rounded bg-[#e7f3e8] text-[#173d2b] font-mono text-xs">
            {matchStr.slice(1, -1)}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(idx);
      return;
    }

    // Unordered list item
    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
      currentList.push(line.replace(/^(\*|-|•)\s+/, ''));
      return;
    }

    // Numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      flushList(idx);
      elements.push(
        <div key={`num-${idx}`} className="flex gap-2.5 my-1.5 text-[14px] leading-relaxed text-[#173d2b]">
          <span className="font-semibold text-[#24764b] select-none">{numberedMatch[1]}.</span>
          <div>{formatInline(numberedMatch[2])}</div>
        </div>
      );
      return;
    }

    // Header
    if (line.startsWith('### ')) {
      flushList(idx);
      elements.push(
        <h4 key={`h3-${idx}`} className="text-base font-bold text-[#173d2b] mt-3 mb-1">
          {formatInline(line.replace('### ', ''))}
        </h4>
      );
      return;
    }

    if (line.startsWith('## ') || line.startsWith('# ')) {
      flushList(idx);
      elements.push(
        <h3 key={`h2-${idx}`} className="text-lg font-bold text-[#173d2b] mt-4 mb-1.5">
          {formatInline(line.replace(/^#+\s*/, ''))}
        </h3>
      );
      return;
    }

    // Regular paragraph
    flushList(idx);
    elements.push(
      <p key={`p-${idx}`} className="my-1.5 text-[14px] leading-[1.75] text-[#173d2b]">
        {formatInline(line)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-0.5">{elements}</div>;
};
