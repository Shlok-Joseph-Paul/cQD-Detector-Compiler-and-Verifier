"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import growth from "@/data/generated/paper-growth.json";

const points = growth.points.map((point) => ({
  ...point,
  label: new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${point.month}-01T00:00:00Z`)),
}));

export function PaperGrowthChart() {
  const latest = points.at(-1)!;
  return (
    <section className="paper-growth" aria-labelledby="paper-growth-title">
      <header>
        <div>
          <p className="section-kicker">Atlas growth</p>
          <h2 id="paper-growth-title">Total papers by month</h2>
        </div>
        <p className="paper-growth__total">
          <strong>{latest.papers}</strong> papers
        </p>
      </header>
      <div className="paper-growth__plot">
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          <LineChart
            data={points}
            margin={{ top: 22, right: 30, bottom: 4, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={28}
              tick={{ fill: "var(--ink-soft)", fontSize: 14 }}
            />
            <YAxis
              domain={[0, "auto"]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={42}
              tick={{ fill: "var(--ink-soft)", fontSize: 14 }}
            />
            <Tooltip
              formatter={(value) => [value, "Total papers"]}
              contentStyle={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 14,
              }}
            />
            <Line
              type="linear"
              dataKey="papers"
              name="Total papers"
              stroke="var(--teal)"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="paper-growth__note">
        Month-end totals, including papers pending review. {latest.label} is to
        date ({growth.as_of}).
      </p>
      <table className="sr-only">
        <caption>Atlas paper count by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Total papers</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <th scope="row">
                {point.label}
                {point === latest ? " (to date)" : ""}
              </th>
              <td>{point.papers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
