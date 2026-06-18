import "./solution.css";
import { MaterialIcon } from "../../lib/icons";
import { getVisiblePlateLabel } from "../../lib/notation";
import { playPlateClicks } from "../../lib/plateClick";

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
            onClick={() => {
              const clickCount = Math.min(3, Math.abs(index - currentIndex));
              if (clickCount > 0) {
                playPlateClicks(clickCount);
              }

              onSelect(index);
            }}
          >
            <span className="solution-step-label">{chunk.type === "move" && chunk.move ? getVisiblePlateLabel(chunk.move.plate, chunk.offsets.length) : chunk.label}</span>
            {chunk.type === "move" && chunk.move ? (
              <MaterialIcon name={chunk.move.direction === "up" ? "arrow_back" : "arrow_forward"} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
