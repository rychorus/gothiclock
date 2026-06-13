export function SolutionSequence({ chunks, currentIndex, onSelect, className = "solution-sequence is-collapsed" }) {
  if (!Array.isArray(chunks) || !chunks.length) {
    return null;
  }

  return (
    <div className={className} id={className.includes("solution-sequence") ? "solutionSequence" : undefined}>
      {chunks.map((chunk, index) => {
        const classes = ["solution-step"];
        if (index < currentIndex) {
          classes.push("is-done");
        } else if (index === currentIndex) {
          classes.push("is-current");
        }

        return (
          <button
            key={chunk.id}
            className={classes.join(" ")}
            type="button"
            data-solution-step={index}
            onClick={() => onSelect(index)}
          >
            {chunk.keyGroups.map(({ key, count }) => (
              <span className="solution-key-group" key={`${chunk.id}-${key}-${count}`}>
                <span className="solution-key">{key}</span>
                {count > 1 ? <span className="solution-key-count">&times;{count}</span> : null}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
}
