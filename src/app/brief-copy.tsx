function unescapeText(text: string) {
  return text.replace(/\\([\\`*_{}[\]()<>~|&!])/g, "$1");
}

function briefLine(line: string) {
  const label = line.match(/^\*\*([^*]+)\*\* (.*)$/);
  if (label) return <><strong>{label[1]}</strong> {unescapeText(label[2])}</>;

  const reference = line.match(/^\[(.+)\]\((https?:\/\/[^\s)]+)\)(.*)$/);
  if (reference) {
    return (
      <>
        <a href={reference[2]} target="_blank" rel="noreferrer">{unescapeText(reference[1])}</a>
        <span className="reference-note">{unescapeText(reference[3]).replace(/^ · /, "")}</span>
      </>
    );
  }

  return unescapeText(line);
}

export function BriefCopy({ markdown }: { markdown: string }) {
  return (
    <div className="brief-copy">
      {markdown.split(/\n{2,}/).map((block, index) => {
        if (block === "# Glimpsea wall art brief" || block === "# Glimpsea product research brief") return null;
        if (block.startsWith("## ")) return <h3 key={index}>{unescapeText(block.slice(3))}</h3>;
        if (block.startsWith("### ")) return <h4 key={index}>{unescapeText(block.slice(4))}</h4>;

        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return <ul key={index}>{lines.map((line, row) => <li key={row}>{briefLine(line.slice(2))}</li>)}</ul>;
        }
        return <p key={index}>{lines.map((line, row) => <span key={row}>{briefLine(line)}</span>)}</p>;
      })}
    </div>
  );
}
