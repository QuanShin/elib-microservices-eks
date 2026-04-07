import { coverGradient } from "../utils/bookVisuals";

export default function BookCover({
  title,
  category,
  className = ""
}: {
  title: string;
  category: string;
  className?: string;
}) {
  return (
    <div
      className={`book-cover ${className}`.trim()}
      style={{ backgroundImage: coverGradient(`${title}-${category}`) }}
      aria-label={`${title} cover`}
    >
      <div className="book-cover__shine" />
      <div className="book-cover__spine" />
      <div className="book-cover__icon">📘</div>
    </div>
  );
}