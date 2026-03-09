import { categoryEmoji, coverGradient, coverLabel } from "../utils/bookVisuals";

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
    >
      <div className="book-cover__emoji">{categoryEmoji(category)}</div>
      <div className="book-cover__title">{coverLabel(title)}</div>
      <div className="book-cover__spine" />
    </div>
  );
}