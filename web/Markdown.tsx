import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const plugins = [remarkGfm];
/** Raw HTML stays escaped; the renderer also rejects unsafe URL protocols. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={plugins}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} rel="noreferrer noopener" />
          ),
          // Keep external images from making requests merely by viewing task text.
          img: ({ alt }) => <span>{alt || "Image"}</span>,
        }}
      >
        {text || "—"}
      </ReactMarkdown>
    </div>
  );
}
