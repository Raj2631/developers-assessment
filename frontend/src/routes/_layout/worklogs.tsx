import { type ColumnDef } from "@tanstack/react-table"
import { createFileRoute, Link } from "@tanstack/react-router"
import axios from "axios"
import { ArrowRight, ClipboardList } from "lucide-react"
import { useEffect, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_layout/worklogs")({
  component: WorkLogs,
  head: () => ({
    meta: [{ title: "WorkLogs" }],
  }),
})

type ActiveFilter = "status" | "freelancer" | null

const STATUS_OPTIONS = ["all", "pending", "paid"] as const
type StatusOption = (typeof STATUS_OPTIONS)[number]

function WorkLogs() {
  const [worklogs, setWorklogs] = useState<any[]>([])
  const [freelancers, setFreelancers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // date range inputs
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [appliedDateFrom, setAppliedDateFrom] = useState("")
  const [appliedDateTo, setAppliedDateTo] = useState("")

  // exclusive filter tabs
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null)
  const [selectedStatus, setSelectedStatus] = useState<StatusOption>("all")
  const [selectedFreelancer, setSelectedFreelancer] = useState("all")

  const token = localStorage.getItem("access_token") || ""
  const baseUrl = import.meta.env.VITE_API_URL

  const fetchWorklogs = async (df: string, dt: string) => {
    try {
      setLoading(true)
      setError(null)
      let url = `${baseUrl}/api/v1/worklog/`
      const params: string[] = []
      if (df) params.push(`date_from=${df}`)
      if (dt) params.push(`date_to=${dt}`)
      if (params.length) url += `?${params.join("&")}`

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setWorklogs(res.data.data ?? [])
    } catch {
      setError("Failed to load worklogs.")
    } finally {
      setLoading(false)
    }
  }

  const fetchFreelancers = async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/v1/worklog/freelancers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFreelancers(res.data ?? [])
    } catch {
      // non-critical — filter tab will just be empty
    }
  }

  useEffect(() => {
    fetchWorklogs("", "")
    fetchFreelancers()
  }, [])

  const handleApplyFilter = () => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    fetchWorklogs(dateFrom, dateTo)
  }

  const handleClearDates = () => {
    setDateFrom("")
    setDateTo("")
    setAppliedDateFrom("")
    setAppliedDateTo("")
    fetchWorklogs("", "")
  }

  const toggleFilter = (filter: ActiveFilter) => {
    setActiveFilter((prev) => (prev === filter ? null : filter))
  }

  // client-side filtering on top of the API-filtered data
  const filtered = worklogs.filter((wl) => {
    if (activeFilter === "status" && selectedStatus !== "all") {
      if (wl.status !== selectedStatus) return false
    }
    if (activeFilter === "freelancer" && selectedFreelancer !== "all") {
      if (wl.freelancer_id !== selectedFreelancer) return false
    }
    return true
  })

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "task_title",
      header: "Task",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.task_title || "—"}</span>
      ),
    },
    {
      accessorKey: "freelancer_name",
      header: "Freelancer",
      cell: ({ row }) => row.original.freelancer_name || "—",
    },
    {
      accessorKey: "total_hrs",
      header: "Total Hours",
      cell: ({ row }) => (
        <span className="font-mono">{Number(row.original.total_hrs).toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "earned_amt",
      header: "Earned Amount",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          ${Number(row.original.earned_amt).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.status === "paid"
              ? "border-green-500 text-green-600 dark:text-green-400"
              : "border-amber-500 text-amber-600 dark:text-amber-400"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.created_at}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Link
          to="/worklogs/$worklogId"
          params={{ worklogId: row.original.id }}
          className="flex items-center gap-1 text-primary hover:underline cursor-pointer text-sm"
        >
          View <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WorkLogs</h1>
          <p className="text-muted-foreground">Review freelancer work and earnings</p>
        </div>
        <Link to="/payments">
          <Button className="cursor-pointer">
            Initiate Payment <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-4 p-4 border rounded-lg bg-card">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date-from">Date From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="date-to">Date To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          onClick={handleApplyFilter}
          disabled={!dateFrom || !dateTo}
          className="cursor-pointer"
        >
          Apply Filter
        </Button>
        {(appliedDateFrom || appliedDateTo) && (
          <Button variant="outline" onClick={handleClearDates} className="cursor-pointer">
            Clear
          </Button>
        )}
      </div>

      {/* Exclusive filter tabs */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Status tab */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => toggleFilter("status")}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer ${
              activeFilter === "status"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted"
            }`}
          >
            Status {activeFilter === "status" ? "▲" : "▼"}
          </button>
          {activeFilter === "status" && (
            <div className="flex flex-col border rounded-md bg-card shadow-sm overflow-hidden w-36">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className={`px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                    selectedStatus === s
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Freelancer tab */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => toggleFilter("freelancer")}
            className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer ${
              activeFilter === "freelancer"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted"
            }`}
          >
            Freelancer {activeFilter === "freelancer" ? "▲" : "▼"}
          </button>
          {activeFilter === "freelancer" && (
            <div className="flex flex-col border rounded-md bg-card shadow-sm overflow-hidden w-48">
              <button
                onClick={() => setSelectedFreelancer("all")}
                className={`px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                  selectedFreelancer === "all"
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                All Freelancers
              </button>
              {freelancers.map((fl: any) => (
                <button
                  key={fl.id}
                  onClick={() => setSelectedFreelancer(fl.id)}
                  className={`px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                    selectedFreelancer === fl.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  {fl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive text-sm p-4 border border-destructive/30 rounded-md bg-destructive/5">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No worklogs found</h3>
          <p className="text-muted-foreground">Try adjusting the date range or filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={filtered} />
        </div>
      )}
    </div>
  )
}
