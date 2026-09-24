"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import growth from "@/data/generated/paper-growth.json";
import activity from "@/data/generated/github-commits.json";

const commitsByMonth = new Map(
  activity.points.map((point) => [point.month, point.commits]),
);

const points = growth.points.map((point) => ({
  ...point,
  commits:
    point.month <= activity.as_of.slice(0, 7)
      ? (commitsByMonth.get(point.month) ?? 0)
      : null,
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
          <h2 id="paper-growth-title">Papers and GitHub activity</h2>
        </div>
        <p className="paper-growth__total">
          <strong>{latest.papers}</strong> papers
        </p>
      </header>
      <div className="paper-growth__legend" aria-label="Chart series and axes">
        <span>
          <i className="paper-growth__line-key" aria-hidden="true" /> Total
          papers · left axis
        </span>
        <span>
          <i className="paper-growth__bar-key" aria-hidden="true" /> GitHub
          commits / month · right axis
        </span>
      </div>
      <div className="paper-growth__plot">
        <ResponsiveContainer width="100%" height={260} minWidth={0}>
          <ComposedChart
            data={points}
            margin={{ top: 22, right: 0, bottom: 4, left: 0 }}
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
              yAxisId="papers"
              domain={[0, "auto"]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={42}
              tick={{ fill: "var(--teal)", fontSize: 14 }}
            />
            <YAxis
              yAxisId="commits"
              orientation="right"
              domain={[0, "auto"]}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={42}
              tick={{ fill: "var(--amber)", fontSize: 14 }}
            />
            <Tooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 14,
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            />
            <Bar
              yAxisId="commits"
              dataKey="commits"
              name="GitHub commits this month"
              fill="var(--amber)"
              fillOpacity={0.45}
              maxBarSize={56}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              yAxisId="papers"
              type="linear"
              dataKey="papers"
              name="Total papers"
              stroke="var(--teal)"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="paper-growth__note">
        Papers are month-end totals, including pending reviews; latest total as
        of {growth.as_of}. Bars count commits on{" "}
        <a
          href={`${activity.repository}/commits/${activity.branch}`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub main
        </a>{" "}
        by UTC month, including merges, as of {activity.as_of.slice(0, 10)}. The
        current month is partial. The two axes use different scales.
      </p>
      <table className="sr-only">
        <caption>Total atlas papers and monthly GitHub commits</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Total papers</th>
            <th scope="col">GitHub commits this month</th>
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
              <td>{point.commits ?? "Not yet available"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
