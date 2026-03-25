import { type ColumnDef } from "@tanstack/react-table"
import { createFileRoute, Link } from "@tanstack/react-router"
import axios from "axios"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/_layout/worklogs/$worklogId")({
  component: WorkLogDetail,
  head: () => ({
    meta: [{ title: "WorkLog Detail" }],
  }),
})

function WorkLogDetail() {
  const { worklogId } = Route.useParams()
  const [worklog, setWorklog] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const token = localStorage.getItem("access_token") || ""
  const baseUrl = import.meta.env.VITE_API_URL

  useEffect(() => {
    const fetchWorklog = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await axios.get(`${baseUrl}/api/v1/worklog/${worklogId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setWorklog(res.data)
      } catch {
        setError("Failed to load worklog.")
      } finally {
        setLoading(false)
      }
    }
    fetchWorklog()
  }, [worklogId])

  const entryColumns: ColumnDef<any>[] = [
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span>{row.original.description}</span>,
    },
    {
      accessorKey: "hours",
      header: "Hours",
      cell: ({ row }) => (
        <span className="font-mono">{Number(row.original.hours).toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "entry_date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.entry_date}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.created_at}</span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-40 bg-muted animate-pulse rounded-lg" />
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-destructive text-sm p-4 border border-destructive/30 rounded-md bg-destructive/5">
        {error}
      </div>
    )
  }

  if (!worklog) return null

  const totalHrs = Number(worklog.total_hrs).toFixed(2)
  const earnedAmt = Number(worklog.earned_amt).toFixed(2)
  const hourlyRate = Number(worklog.freelancer?.hourly_rate ?? 0).toFixed(2)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        to="/worklogs"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to WorkLogs
      </Link>

      {/* Summary card */}
      <div className="border rounded-lg p-6 bg-card flex flex-col gap-4">
        <h1 className="text-xl font-bold tracking-tight">WorkLog Detail</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Task</span>
            <span className="font-medium">{worklog.task?.title ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Freelancer</span>
            <span className="font-medium">{worklog.freelancer?.name ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
            <Badge
              variant="outline"
              className={
                worklog.status === "paid"
                  ? "border-green-500 text-green-600 dark:text-green-400 w-fit"
                  : "border-amber-500 text-amber-600 dark:text-amber-400 w-fit"
              }
            >
              {worklog.status}
            </Badge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Hourly Rate</span>
            <span className="font-mono font-medium">${hourlyRate}/hr</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Hours</span>
            <span className="font-mono font-medium">{totalHrs} hrs</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Earned Amount</span>
            <span className="font-mono font-bold text-lg">${earnedAmt}</span>
          </div>
        </div>
      </div>

      {/* Time entries */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Time Entries</h2>
        {worklog.entries?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No time entries recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTable columns={entryColumns} data={worklog.entries ?? []} />
          </div>
        )}
      </div>
    </div>
  )
}
