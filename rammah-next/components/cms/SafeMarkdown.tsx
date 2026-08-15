import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export type SafeMarkdownProps = {
  children: string;
  className?: string;
};

export function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
