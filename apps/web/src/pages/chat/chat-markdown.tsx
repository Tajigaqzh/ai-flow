import styles from './index.module.less';

type MarkdownInlineSegment = {
  key: string;
  text: string;
  type: 'code' | 'strong' | 'text';
};

type MarkdownLine = {
  key: string;
  segments: MarkdownInlineSegment[];
};

type MarkdownBlock =
  | {
      key: string;
      lines: MarkdownLine[];
      type: 'paragraph';
    }
  | {
      items: MarkdownLine[];
      key: string;
      ordered: boolean;
      type: 'list';
    }
  | {
      key: string;
      text: string;
      type: 'code';
    };

type MarkdownParseState = {
  blocks: MarkdownBlock[];
  codeLines: string[];
  codeStartLine: number;
  inCodeBlock: boolean;
  listItems: MarkdownLine[];
  listOrdered: boolean;
  paragraphLines: MarkdownLine[];
};

function createMarkdownKey(
  prefix: string,
  lineNumber: number,
  text: string,
  order = 0,
) {
  const normalizedText = text.trim().slice(0, 32).replace(/\s+/g, '-');

  return `${prefix}-${lineNumber}-${order}-${normalizedText || 'empty'}`;
}

function parseInlineMarkdown(text: string, lineNumber: number) {
  const segments: MarkdownInlineSegment[] = [];
  const tokenPattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let segmentOrder = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      const plainText = text.slice(lastIndex, matchIndex);
      segments.push({
        key: createMarkdownKey('text', lineNumber, plainText, segmentOrder),
        text: plainText,
        type: 'text',
      });
      segmentOrder += 1;
    }

    const token = match[0];
    const isStrong = token.startsWith('**');
    const tokenType = isStrong ? 'strong' : 'code';
    const tokenStart = isStrong ? 2 : 1;
    const tokenEnd = isStrong ? -2 : -1;

    segments.push({
      key: createMarkdownKey(tokenType, lineNumber, token, segmentOrder),
      text: token.slice(tokenStart, tokenEnd),
      type: tokenType,
    });
    segmentOrder += 1;
    lastIndex = matchIndex + token.length;
  }

  if (lastIndex < text.length) {
    const plainText = text.slice(lastIndex);
    segments.push({
      key: createMarkdownKey('text', lineNumber, plainText, segmentOrder),
      text: plainText,
      type: 'text',
    });
  }

  return segments.length > 0
    ? segments
    : [
        {
          key: createMarkdownKey('text', lineNumber, text),
          text,
          type: 'text' as const,
        },
      ];
}

function createMarkdownLine(text: string, lineNumber: number): MarkdownLine {
  return {
    key: createMarkdownKey('line', lineNumber, text),
    segments: parseInlineMarkdown(text, lineNumber),
  };
}

function createMarkdownParseState(): MarkdownParseState {
  return {
    blocks: [],
    codeLines: [],
    codeStartLine: 0,
    inCodeBlock: false,
    listItems: [],
    listOrdered: false,
    paragraphLines: [],
  };
}

function flushMarkdownParagraph(state: MarkdownParseState) {
  if (state.paragraphLines.length === 0) {
    return;
  }

  state.blocks.push({
    key: state.paragraphLines[0].key,
    lines: [...state.paragraphLines],
    type: 'paragraph',
  });
  state.paragraphLines.length = 0;
}

function flushMarkdownList(state: MarkdownParseState) {
  if (state.listItems.length === 0) {
    return;
  }

  state.blocks.push({
    items: [...state.listItems],
    key: state.listItems[0].key,
    ordered: state.listOrdered,
    type: 'list',
  });
  state.listItems = [];
}

function flushMarkdownCode(state: MarkdownParseState, endLineNumber: number) {
  state.blocks.push({
    key: createMarkdownKey(
      'code-block',
      state.codeStartLine || endLineNumber,
      '',
    ),
    text: state.codeLines.join('\n'),
    type: 'code',
  });
  state.codeLines = [];
  state.codeStartLine = 0;
}

function handleMarkdownFence(state: MarkdownParseState, lineNumber: number) {
  flushMarkdownParagraph(state);
  flushMarkdownList(state);

  if (state.inCodeBlock) {
    flushMarkdownCode(state, lineNumber);
    state.inCodeBlock = false;
    return;
  }

  state.inCodeBlock = true;
  state.codeStartLine = lineNumber;
}

function handleMarkdownListItem(
  state: MarkdownParseState,
  lineNumber: number,
  orderedListItem: RegExpMatchArray | null,
  unorderedListItem: RegExpMatchArray | null,
) {
  const nextOrdered = Boolean(orderedListItem);

  flushMarkdownParagraph(state);

  if (state.listItems.length > 0 && state.listOrdered !== nextOrdered) {
    flushMarkdownList(state);
  }

  state.listOrdered = nextOrdered;
  state.listItems.push(
    createMarkdownLine(
      (orderedListItem ?? unorderedListItem)?.[1] ?? '',
      lineNumber,
    ),
  );
}

function handleMarkdownLine(
  state: MarkdownParseState,
  line: string,
  lineNumber: number,
) {
  const trimmedLine = line.trim();

  if (trimmedLine.startsWith('```')) {
    handleMarkdownFence(state, lineNumber);
    return;
  }

  if (state.inCodeBlock) {
    state.codeLines.push(line);
    return;
  }

  if (!trimmedLine) {
    flushMarkdownParagraph(state);
    flushMarkdownList(state);
    return;
  }

  const orderedListItem = trimmedLine.match(/^\d+\.\s+(.+)$/);
  const unorderedListItem = trimmedLine.match(/^[-*]\s+(.+)$/);

  if (orderedListItem || unorderedListItem) {
    handleMarkdownListItem(
      state,
      lineNumber,
      orderedListItem,
      unorderedListItem,
    );
    return;
  }

  flushMarkdownList(state);
  state.paragraphLines.push(
    createMarkdownLine(line.replace(/\s{2}$/, ''), lineNumber),
  );
}

function parseChatMarkdown(content: string) {
  const state = createMarkdownParseState();
  const lines = content.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    handleMarkdownLine(state, line, lineIndex + 1);
  });

  if (state.inCodeBlock) {
    flushMarkdownCode(state, lines.length);
  }

  flushMarkdownParagraph(state);
  flushMarkdownList(state);

  return state.blocks;
}

function MarkdownInline({ segments }: { segments: MarkdownInlineSegment[] }) {
  return (
    <>
      {segments.map((segment) => {
        if (segment.type === 'strong') {
          return <strong key={segment.key}>{segment.text}</strong>;
        }

        if (segment.type === 'code') {
          return <code key={segment.key}>{segment.text}</code>;
        }

        return <span key={segment.key}>{segment.text}</span>;
      })}
    </>
  );
}

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className={styles.markdownBody}>
      {parseChatMarkdown(content).map((block) => {
        if (block.type === 'code') {
          return (
            <pre key={block.key}>
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';

          return (
            <ListTag key={block.key}>
              {block.items.map((item) => (
                <li key={item.key}>
                  <MarkdownInline segments={item.segments} />
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={block.key}>
            {block.lines.map((line, lineIndex) => (
              <span key={line.key}>
                {lineIndex > 0 ? <br /> : null}
                <MarkdownInline segments={line.segments} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
