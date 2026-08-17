import React from 'react'
import { Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { CHART_SERIES_COLORS } from '../../theme/charts'
import { primary, secondary, success, warning, error, gray } from '../../theme/colors'

const STATUS_COLORS = {
  active:     success[500],
  inactive:   gray[400],
  on_leave:   warning[500],
  terminated: error[500],
}

const AXIS_TICK = { fontSize: 12, fill: gray[500] }
const CHART_HEIGHT = 'h-64'

function seriesColor(i) {
  return CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]
}

// Long department names rotated at an angle overlap/clip each other when
// packed tightly (12+ categories in a narrow card). Truncate what's drawn on
// the axis; the full name still shows in the Tooltip since that reads the
// underlying data point, not this rendered tick text.
function TruncatedTick({ x, y, payload }) {
  const label = payload.value || ''
  const truncated = label.length > 14 ? `${label.slice(0, 13)}…` : label
  return (
    <text x={x} y={y} dy={10} textAnchor="end" fill={gray[500]} fontSize={11} transform={`rotate(-45, ${x}, ${y})`}>
      {truncated}
    </text>
  )
}

const RADIAN = Math.PI / 180

// Pie slices below ~5% sit at nearly the same angle as their neighbors, so
// leader-line labels converge on the same point and overlap (e.g. two tiny
// adjacent slices both labeling near the pie's edge). Drop the label for
// slices too small to place cleanly — the legend and Tooltip still carry
// that information — instead of drawing a connector line that collides.
function makePieLabel(formatValue) {
  return function PieLabel({ cx, cy, midAngle, outerRadius, percent, value }) {
    if (percent < 0.05) return null
    const radius = outerRadius + 18
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={600} fill={gray[600]}>
        {formatValue(value)}
      </text>
    )
  }
}

function ChartCard({ title, subtitle, loading, empty, children }) {
  return (
    <div className="card p-5">
      <h3 className="font-bold text-gray-900 text-widget-label">{title}</h3>
      {subtitle && <p className="text-dense text-gray-400 mb-3">{subtitle}</p>}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-primary-500" />
        </div>
      ) : empty ? (
        <p className="text-sm text-gray-400 text-center py-6">No data available.</p>
      ) : <div className={subtitle ? CHART_HEIGHT : `${CHART_HEIGHT} mt-4`}>{children}</div>}
    </div>
  )
}

function DepartmentBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 50, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gray[100]} />
        <XAxis dataKey="name" tick={<TruncatedTick />} interval={0} height={70} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip cursor={{ fill: gray[50] }} />
        <Bar dataKey="value" fill={primary[600]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const roleLabel = makePieLabel((v) => v)

function RolePieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" label={roleLabel} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function StatusDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] || seriesColor(i)} />)}
        </Pie>
        <Tooltip />
        <Legend formatter={(v) => v.replace('_', ' ')} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function MonthlyAdditionsLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gray[100]} />
        <XAxis dataKey="month" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke={secondary[400]} strokeWidth={2} dot={{ r: 4, fill: secondary[400] }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function LoginActivityBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gray[100]} />
        <XAxis dataKey="day" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip cursor={{ fill: gray[50] }} />
        <Bar dataKey="value" fill={primary[400]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const departmentDistributionLabel = makePieLabel((v) => `${v}%`)

function DepartmentDistributionPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" label={departmentDistributionLabel} labelLine={false}>
          {data.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
        </Pie>
        <Tooltip formatter={(v) => `${v}%`} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function UserChartsPanel({ charts, loading }) {
  const byDepartment = charts?.usersByDepartment || []
  const byRole = charts?.usersByRole || []
  const activeVsInactive = charts?.activeVsInactive || []
  const monthlyAdditions = charts?.monthlyAdditions || []
  const loginActivity = charts?.loginActivity || []
  const departmentDistribution = charts?.departmentDistribution || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <ChartCard title="Users by Department" subtitle="Headcount distribution across departments" loading={loading} empty={!loading && byDepartment.length === 0}>
          <DepartmentBarChart data={byDepartment} />
        </ChartCard>

        <ChartCard title="Users by Role" subtitle="Role distribution across the org" loading={loading} empty={!loading && byRole.length === 0}>
          <RolePieChart data={byRole} />
        </ChartCard>

        <ChartCard title="Active vs Inactive Users" subtitle="Current account status split" loading={loading} empty={!loading && activeVsInactive.length === 0}>
          <StatusDonutChart data={activeVsInactive} />
        </ChartCard>

        <ChartCard title="Monthly User Additions" subtitle="New employees onboarded per month" loading={loading} empty={!loading && monthlyAdditions.length === 0}>
          <MonthlyAdditionsLineChart data={monthlyAdditions} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Login Activity" subtitle="Logins per day (last 14 active days)" loading={loading} empty={!loading && loginActivity.length === 0}>
          <LoginActivityBarChart data={loginActivity} />
        </ChartCard>

        <ChartCard title="Department Distribution" subtitle="Share of total headcount (%)" loading={loading} empty={!loading && departmentDistribution.length === 0}>
          <DepartmentDistributionPieChart data={departmentDistribution} />
        </ChartCard>
      </div>
    </div>
  )
}
