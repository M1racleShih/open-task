// Original solid clipboard silhouette, licensed under MIT (see task-icon-LICENSE.txt).
export function TaskIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="task-icon"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 2h8v3H8V2ZM6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1v3H6V4Zm1 6v2h2v-2H7Zm4 0v2h6v-2h-6Zm-4 5v2h2v-2H7Zm4 0v2h6v-2h-6Z"
      />
    </svg>
  );
}
