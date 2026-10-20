export function CitationText({
  text,
  onCite,
}: {
  text: string;
  onCite: (id: number) => void;
}) {
  const parts = text.split(/(\[\d{1,2}\])/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\[(\d{1,2})\]$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const id = Number(match[1]);
        return (
          <button
            key={index}
            type="button"
            className="cite"
            onClick={() => onCite(id)}
            aria-label={`Go to source ${id}`}
            title={`Source ${id}`}
          >
            {id}
          </button>
        );
      })}
    </>
  );
}
