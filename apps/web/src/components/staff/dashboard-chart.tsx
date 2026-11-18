"use client";
import { useId, type ReactNode } from "react";
import { Empty } from "@/components/console/ui";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { financeNumber } from "@/lib/staff/finance-presentation";
import { DashboardPanel } from "./dashboard-widgets";
import styles from "./dashboard.module.css";

export type ChartSeries = { key: string; label: string; color: string };
export type ChartPoint = {
  label: string;
  values: Record<string, number | string>;
};
type ChartProps = {
  title: string;
  description: string;
  points: ChartPoint[];
  series: ChartSeries[];
  bars?: boolean;
  unit?: string;
  total?: string;
  totalLabel?: string;
  footer?: ReactNode;
  available?: boolean;
  loading?: boolean;
};
const chartValue = (value?: number | string) =>
  typeof value === "number"
    ? value.toLocaleString("vi-VN")
    : financeNumber(value ?? "");
function shortDate(value: string) {
  const parts = value.split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}`
    : `${parts[1]}/${parts[0]}`;
}
export function DashboardChart({
  title,
  description,
  points,
  series,
  bars = false,
  unit = "",
  total,
  totalLabel,
  footer,
  available = true,
  loading = false,
}: Readonly<ChartProps>) {
  let emptyTitle = "Chưa có dữ liệu trong kỳ";
  if (!available) emptyTitle = "Chưa tải được số liệu";
  return (
    <DashboardPanel
      title={title}
      description={description}
      total={total}
      totalLabel={totalLabel}
      footer={footer}
      className={styles.chartCard}
    >
      {!points.length ? (
        <div className={styles.emptyChart}>
          {loading ? (
            <LoadingSkeleton label="Đang tải số liệu" />
          ) : (
            <Empty
              title={emptyTitle}
              desc="Chọn khoảng thời gian hoặc làm mới để kiểm tra."
            />
          )}
        </div>
      ) : (
        <>
          <ul className={styles.legend} aria-label="Chú giải">
            {series.map((item) => (
              <li key={item.key}>
                <span style={{ background: item.color }} />
                {item.label}
                {unit && ` (${unit})`}
              </li>
            ))}
          </ul>
          {bars ? (
            <BarPlot
              title={title}
              points={points}
              series={series}
              unit={unit}
            />
          ) : (
            <LinePlot title={title} points={points} series={series} />
          )}
          <details className={styles.chartData}>
            <summary>Xem bảng số liệu</summary>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Kỳ</th>
                    {series.map((item) => (
                      <th key={item.key} scope="col">
                        {item.label}
                        {unit && ` (${unit})`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.label}>
                      <th scope="row">{point.label}</th>
                      {series.map((item) => (
                        <td key={item.key}>
                          {chartValue(point.values[item.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </DashboardPanel>
  );
}
function BarPlot({
  title,
  points,
  series,
  unit,
}: Readonly<{
  title: string;
  points: ChartPoint[];
  series: ChartSeries[];
  unit: string;
}>) {
  const values = points.flatMap((point) =>
    series.map((item) => Number(point.values[item.key] ?? 0)),
  );
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values),
    span = max - min;
  const baseline = (-min / span) * 100;
  return (
    <div className={styles.plotScroll}>
      <figure
        className={styles.barPlot}
        aria-label={title}
        style={{
          gridTemplateColumns: `repeat(${points.length}, minmax(22px, 1fr))`,
          minWidth: points.length > 12 ? points.length * 36 : undefined,
        }}
      >
        {points.map((point) => (
          <div
            className={styles.barGroup}
            key={point.label}
            tabIndex={0}
            aria-label={
              point.label +
              ": " +
              series
                .map(
                  (item) =>
                    `${item.label} ${chartValue(point.values[item.key])} ${unit}`,
                )
                .join(", ")
            }
          >
            <div className={styles.barColumns}>
              {series.map((item, index) => {
                const value = Number(point.values[item.key] ?? 0);
                return (
                  <span
                    key={item.key}
                    style={{
                      height: `${(Math.abs(value) / span) * 100}%`,
                      bottom: `${baseline + (Math.min(0, value) / span) * 100}%`,
                      left: `${12 + (index * 76) / series.length}%`,
                      width: `${76 / series.length - 3}%`,
                      background: item.color,
                    }}
                  />
                );
              })}
            </div>
            <small>{shortDate(point.label)}</small>
            <span className={styles.barTooltip}>
              <strong>{point.label}</strong>
              {series.map((item) => (
                <span key={item.key}>
                  {item.label}: {chartValue(point.values[item.key])} {unit}
                </span>
              ))}
            </span>
          </div>
        ))}
      </figure>
    </div>
  );
}
function LinePlot({
  title,
  points,
  series,
}: Readonly<{ title: string; points: ChartPoint[]; series: ChartSeries[] }>) {
  const id = useId();
  const values = points.flatMap((point) =>
    series.map((item) => Number(point.values[item.key] ?? 0)),
  );
  const max = Math.max(1, ...values),
    min = Math.min(0, ...values);
  const x = (index: number) => 48 + ((index + 0.5) / points.length) * 560;
  const y = (value: number) => 176 - ((value - min) / (max - min)) * 150;
  return (
    <figure className={styles.linePlot} aria-labelledby={id}>
      <figcaption id={id} className="sr-only">
        {title}. Xem số liệu đầy đủ bên dưới.
      </figcaption>
      <svg
        viewBox="0 0 640 216"
        className={styles.chart}
        aria-hidden="true"
        focusable="false"
      >
        {[min, (min + max) / 2, max].map((value) => (
          <g key={value}>
            <line
              x1="48"
              x2="608"
              y1={y(value)}
              y2={y(value)}
              stroke="var(--line)"
            />
            <text x="40" y={y(value) + 4} textAnchor="end">
              {new Intl.NumberFormat("vi-VN", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(value)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          const coordinates = points
            .map(
              (point, index) =>
                `${x(index)},${y(Number(point.values[item.key] ?? 0))}`,
            )
            .join(" ");
          return (
            <g key={item.key}>
              <polygon
                points={`${x(0)},${y(0)} ${coordinates} ${x(points.length - 1)},${y(0)}`}
                fill="var(--brand-soft)"
              />
              <polyline
                points={coordinates}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
              />
              {points.map((point, index) => (
                <g key={point.label}>
                  <circle
                    cx={x(index)}
                    cy={y(Number(point.values[item.key] ?? 0))}
                    r="3"
                    fill={item.color}
                  >
                    <title>{`${point.label}: ${item.label} ${chartValue(point.values[item.key])}`}</title>
                  </circle>
                  {points.length <= 12 && (
                    <text
                      x={x(index)}
                      y={y(Number(point.values[item.key] ?? 0)) - 10}
                      textAnchor="middle"
                    >
                      {chartValue(point.values[item.key])}
                    </text>
                  )}
                </g>
              ))}
            </g>
          );
        })}
        {points
          .filter(
            (_, index) =>
              points.length <= 12 ||
              index === 0 ||
              index === points.length - 1 ||
              index === Math.floor(points.length / 2),
          )
          .map((point) => (
            <text
              key={point.label}
              x={x(points.indexOf(point))}
              y="204"
              textAnchor="middle"
            >
              {shortDate(point.label)}
            </text>
          ))}
      </svg>
    </figure>
  );
}
