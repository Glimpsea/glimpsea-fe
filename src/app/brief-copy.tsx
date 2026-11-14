function unescapeText(text: string) {
  return text.replace(/\\([\\`*_{}[\]()<>~|&!])/g, "$1");
}

function briefLine(line: string) {
  const label = line.match(/^\*\*([^*]+)\*\* (.*)$/);
  if (label) return <><strong>{label[1]}</strong> {unescapeText(label[2])}</>;

  const reference = line.match(/^\[(.+)\]\((https?:\/\/[^\s)]+|\/reports\/[a-f0-9-]{36})\)(.*)$/);
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

export function BriefCopy({ markdown, standalone = false }: { markdown: string; standalone?: boolean }) {
  const SectionHeading = standalone ? "h2" : "h3";
  const Subheading = standalone ? "h3" : "h4";
  return (
    <div className="brief-copy">
      {markdown.split(/\n{2,}/).map((block, index) => {
        if (block === "# Glimpsea wall art brief" || block === "# Glimpsea product research brief") return null;
        if (block.startsWith("## ")) return <SectionHeading className="brief-section-title" key={index}>{unescapeText(block.slice(3))}</SectionHeading>;
        if (block.startsWith("### ")) return <Subheading className="brief-subheading" key={index}>{unescapeText(block.slice(4))}</Subheading>;

        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return <ul key={index}>{lines.map((line, row) => <li key={row}>{briefLine(line.slice(2))}</li>)}</ul>;
        }
        return <p key={index}>{lines.map((line, row) => <span key={row}>{briefLine(line)}</span>)}</p>;
      })}
    </div>
  );
}
