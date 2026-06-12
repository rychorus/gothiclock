const PATHS = {
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 000-1.42L18.37 3.29a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z",
  delete: "M6 19c0 1.1.9 2 2 2h8a2 2 0 002-2V7H6v12zm3.46-7.12l1.54 1.54 1.54-1.54 1.06 1.06-1.54 1.54 1.54 1.54-1.06 1.06L11 15.54l-1.54 1.54-1.06-1.06 1.54-1.54-1.54-1.54 1.06-1.06zM15.5 4l-1-1h-5l-1 1H5v2h14V4z",
  save: "M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zM12 19a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z",
  code: "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  play_arrow: "M8 5v14l11-7z",
  restart_alt: "M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 11-11.95-.75H4.02A8 8 0 1012 5z",
  chevron_left: "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z",
  chevron_right: "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z",
  open_in_full: "M21 3h-6v2h2.59l-3.83 3.83 1.41 1.41L19 6.41V9h2V3zM3 15h2v2.59l3.83-3.83 1.41 1.41L6.41 19H9v2H3v-6zm6.41-4.76L5.59 6.41H8V4H2v6h2V7.41l3.83 3.83 1.58-1zm5.17 3.59l-1.41 1.41L17.59 19H15v2h6v-6h-2v2.59l-4.42-4.42z",
};

export function MaterialIcon({ name }) {
  if (name === "more_vert") {
    return (
      <span className="material-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </span>
    );
  }

  return (
    <span className="material-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={PATHS[name] || ""} />
      </svg>
    </span>
  );
}
