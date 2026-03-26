import { type ColumnDef } from "@tanstack/react-table"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import { CheckCircle, CreditCard } from "lucide-react"
import { useEffect, useState } from "react"

import { DataTable } from "@/components/Common/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/_layout/payments")({
  component: Payments,
  head: () => ({
    meta: [{ title: "Payments" }],
  }),
})

type Step = "form" | "preview" | "confirmed"

const STEPS = [
  { key: "form", label: "Select Range" },
  { key: "preview", label: "Review & Exclude" },
  { key: "confirmed", label: "Confirmed" },
] as const

const STEP_ORDER: Step[] = ["form", "preview", "confirmed"]

function StepIndicator({ current, onStepClick }: { current: Step; onStepClick: (s: Step) => void }) {
  const currentIdx = STEP_ORDER.indexOf(current)
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = s.key === current
        return (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => isPast && onStepClick(s.key as Step)}
              disabled={!isPast}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isPast
                  ? "bg-muted text-foreground hover:bg-muted/80 cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              <span>{i + 1}</span>
              <span>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="text-muted-foreground">──</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Payments() {
  const [step, setStep] = useState<Step>("form")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [preview, setPreview] = useState<any>(null)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const token = localStorage.getItem("access_token") || ""
  const baseUrl = import.meta.env.VITE_API_URL

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true)
      const res = await axios.get(`${baseUrl}/api/v1/worklog/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPaymentHistory(res.data.data ?? [])
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const handlePreview = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.post(
        `${baseUrl}/api/v1/worklog/payment/preview`,
        { date_from: dateFrom, date_to: dateTo, excluded_worklog_ids: [] },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setPreview(res.data)
      setExcludedIds(new Set())
      setStep("preview")
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to load preview.")
    } finally {
      setLoading(false)
    }
  }

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedWorklogs = (preview?.worklogs ?? []).filter(
    (wl: any) => !excludedIds.has(wl.id),
  )
  const liveTotal = selectedWorklogs
    .reduce((sum: number, wl: any) => sum + Number(wl.earned_amt), 0)
    .toFixed(2)

  const handleConfirm = async () => {
    try {
      setConfirming(true)
      setError(null)
      const res = await axios.post(
        `${baseUrl}/api/v1/worklog/payment/confirm`,
        {
          date_from: dateFrom,
          date_to: dateTo,
          excluded_worklog_ids: Array.from(excludedIds),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setConfirmed(res.data)
      setStep("confirmed")
      fetchHistory()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Payment failed.")
    } finally {
      setConfirming(false)
      setShowConfirmDialog(false)
    }
  }

  const handleReset = () => {
    setStep("form")
    setDateFrom("")
    setDateTo("")
    setPreview(null)
    setExcludedIds(new Set())
    setConfirmed(null)
    setError(null)
  }

  // Preview table columns with checkboxes
  const previewColumns: ColumnDef<any>[] = [
    {
      id: "select",
      header: () => <span className="text-muted-foreground text-xs">Include</span>,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={!excludedIds.has(row.original.id)}
          onChange={() => toggleExclude(row.original.id)}
          className="cursor-pointer h-4 w-4"
          aria-label={`Include worklog for ${row.original.freelancer_name}`}
        />
      ),
    },
    {
      accessorKey: "freelancer_name",
      header: "Freelancer",
      cell: ({ row }) => row.original.freelancer_name || "—",
    },
    {
      accessorKey: "task_title",
      header: "Task",
      cell: ({ row }) => row.original.task_title || "—",
    },
    {
      accessorKey: "total_hrs",
      header: "Hours",
      cell: ({ row }) => (
        <span className="font-mono">{Number(row.original.total_hrs).toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "earned_amt",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          ${Number(row.original.earned_amt).toFixed(2)}
        </span>
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

  // Payment history columns
  const historyColumns: ColumnDef<any>[] = [
    {
      accessorKey: "id",
      header: "Payment ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>
      ),
    },
    {
      accessorKey: "date_from",
      header: "Date From",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.date_from}</span>
      ),
    },
    {
      accessorKey: "date_to",
      header: "Date To",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.date_to}</span>
      ),
    },
    {
      accessorKey: "total_amt",
      header: "Total Amount",
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          ${Number(row.original.total_amt).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
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
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">Process payment batches for freelancers</p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} onStepClick={setStep} />

      {/* Error */}
      {error && (
        <div className="text-destructive text-sm p-4 border border-destructive/30 rounded-md bg-destructive/5">
          {error}
        </div>
      )}

      {/* Step 1 — Date range form */}
      {step === "form" && (
        <div className="border rounded-lg p-6 bg-card flex flex-col gap-4 max-w-md">
          <h2 className="text-lg font-semibold">Select Date Range</h2>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pay-date-from">
              Date From <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pay-date-to">
              Date To <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button
            onClick={handlePreview}
            disabled={!dateFrom || !dateTo || loading}
            className="cursor-pointer"
          >
            {loading ? "Loading…" : "Preview Eligible WorkLogs →"}
          </Button>
        </div>
      )}

      {/* Step 2 — Review & exclude */}
      {step === "preview" && preview && (
        <div className="flex flex-col gap-4">
            {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg bg-card">
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedWorklogs.length}</span> worklog
              {selectedWorklogs.length !== 1 ? "s" : ""} selected
            </span>
            <span className="font-mono font-bold text-lg">Total: ${liveTotal}</span>
          </div>

          {preview.worklogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No eligible worklogs</h3>
              <p className="text-muted-foreground">No pending worklogs found in this date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable columns={previewColumns} data={preview.worklogs} />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedWorklogs.length === 0 || confirming}
              className="cursor-pointer"
            >
              Confirm Payment ${liveTotal}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirmed */}
      {step === "confirmed" && confirmed && (
        <div className="border-2 border-green-500 rounded-lg p-8 bg-card flex flex-col items-center gap-4 max-w-md text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Payment Confirmed</h2>
          <div className="text-sm text-muted-foreground flex flex-col gap-1 w-full text-left">
            <div className="flex justify-between">
              <span>Payment ID</span>
              <span className="font-mono text-xs text-foreground">{confirmed.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date Range</span>
              <span className="font-medium text-foreground">
                {confirmed.date_from} → {confirmed.date_to}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-mono font-bold text-foreground">
                ${Number(confirmed.total_amt).toFixed(2)}
              </span>
            </div>
          </div>
          <Button onClick={handleReset} className="cursor-pointer mt-2">
            Start New Payment
          </Button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              This will mark{" "}
              <span className="font-semibold">{selectedWorklogs.length} worklog{selectedWorklogs.length !== 1 ? "s" : ""}</span>{" "}
              as paid and create a payment of{" "}
              <span className="font-mono font-semibold">${liveTotal}</span>.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={confirming}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={confirming} className="cursor-pointer">
              {confirming ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment history */}
      <div className="flex flex-col gap-3 pt-4 border-t">
        <h2 className="text-lg font-semibold">Payment History</h2>
        {historyLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : paymentHistory.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <DataTable columns={historyColumns} data={paymentHistory} />
          </div>
        )}
      </div>
    </div>
  )
}
