import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CommandBlock } from './Command'

const components: Components = {
  // Render fenced blocks through the variable-aware CommandBlock.
  pre({ children }) {
    return <>{children}</>
  },
  code(props) {
    const { className, children } = props
    const text = String(children ?? '')
    const isBlock = /language-/.test(className ?? '') || text.includes('\n')
    if (!isBlock) {
      return <code className={className}>{children}</code>
    }
    const lang = /language-(\w+)/.exec(className ?? '')?.[1]
    return <CommandBlock code={text.replace(/\n$/, '')} lang={lang} />
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="scroll-thin my-4 overflow-x-auto">
        <table>{children}</table>
      </div>
    )
  },
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-ic max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
