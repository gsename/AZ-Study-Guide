import { Fragment, type ReactNode } from 'react'

/**
 * Minimal inline markdown renderer supporting **bold** and `code`.
 * Content is authored in-repo, so a small tokenizer is sufficient and
 * avoids pulling in a full markdown dependency.
 */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(
        <code key={key++} className="inline-code">
          {token.slice(1, -1)}
        </code>,
      )
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
  }
  return nodes
}

export default function RichText({ text, as: Tag = 'span' }: { text: string; as?: 'span' | 'p' }) {
  return <Tag>{renderInline(text)}</Tag>
}
