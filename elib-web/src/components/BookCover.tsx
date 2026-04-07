import { coverGradient } from "../utils/bookVisuals";

export default function BookCover({
  title,
  category,
  className = "",
  coverImageUrl
}: {
  title: string;
  category: string;
  className?: string;
  coverImageUrl?: string | null;
}) {
  if (coverImageUrl?.trim()) {
    return (
      <div className={`book-cover real-cover ${className}`.trim()} aria-label={`${title} cover`}>
        <img src={coverImageUrl} alt={title} className="book-cover__img" />
      </div>
    );
  }

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