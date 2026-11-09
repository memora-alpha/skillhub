"use client";
import { useId } from "react";
import { ProductIcon } from "../components/product-icon";
import styles from "./reviews.module.css";

export function ReviewStars({ rating }: Readonly<{ rating: number }>) {
  return (
    <span
      className={styles.stars}
      role="img"
      aria-label={`${rating} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? styles.filled : styles.unfilled}>
          <ProductIcon name="star" size={18} />
        </span>
      ))}
    </span>
  );
}
export function ReviewRatingInput({
  value,
  onChange,
  disabled,
}: Readonly<{
  value: number;
  onChange: (rating: number) => void;
  disabled: boolean;
}>) {
  const name = useId();
  return (
    <fieldset className={styles.ratingInput} disabled={disabled}>
      <legend>Chấm điểm đối tác</legend>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={styles.starChoice}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              required
              onChange={() => onChange(n)}
              aria-label={`${n} sao`}
            />
            <span className={n <= value ? styles.filled : styles.unfilled}>
              <ProductIcon name="star" size={30} />
            </span>
          </label>
        ))}
      </div>
      <p>
        {value
          ? `Bạn đã chọn ${value}/5 sao`
          : "Chọn số sao phù hợp với trải nghiệm của bạn"}
      </p>
    </fieldset>
  );
}
