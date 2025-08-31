"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Loader2,
  ShieldCheck,
  TrendingUp,
  History,
  Ban,
  Users,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "~/components/ui/chart";

// ==================================================================
// INTERFACES & TYPES
// ==================================================================
interface HydrogenRecord {
  id: string;
  pan: string;
  gst: string;
  hydrogen_produced: number;
  electricity_consumed: number;
  created_at: string;
  verified: boolean;
}
interface CompanyRecord {
  id: string;
  company_name: string;
  pan: string | null;
  gst: string | null;
  email: string;
  address: string | null;
  sector: string | null;
  phone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  verified: boolean;
  created_at: string;
  daily_usage: number;
}
interface AuditLog {
  id: string;
  created_at: string;
  from_pan: string;
  to_pan: string;
  amount: number;
  tx_hash: string | null;
  status: "success" | "failed";
  remarks: string | null;
}
type SortKey = keyof CompanyRecord;

// ==================================================================
// REUSABLE SUB-COMPONENTS
// ==================================================================
const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="text-muted-foreground h-4 w-4" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const chartConfig = {
  hydrogen: { label: "H₂ (kg)", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

function CompanyProductionChart({ data }: { data: HydrogenRecord[] }) {
  const chartData = useMemo(
    () =>
      data
        .map((record) => ({
          date: new Date(record.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          hydrogen: record.hydrogen_produced,
        }))
        .reverse(),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verified Hydrogen Production</CardTitle>
        <CardDescription>
          Daily amount of H₂ produced and credited to the blockchain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
              <defs>
                <linearGradient id="fillHydrogen" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-hydrogen)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-hydrogen)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <Tooltip content={<ChartTooltipContent indicator="dot" />} />
              <Area
                dataKey="hydrogen"
                type="natural"
                fill="url(#fillHydrogen)"
                stroke="var(--color-hydrogen)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="text-muted-foreground flex h-[250px] items-center justify-center">
            No production data to display.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================================================================
// MAIN ADMIN DASHBOARD COMPONENT
// ==================================================================
export default function AdminDashboardPage() {
  // --- 1. HOOKS & STATE MANAGEMENT ---
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionCompanyId, setActionCompanyId] = useState<string | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(
    null,
  );
  const [companyProduction, setCompanyProduction] = useState<HydrogenRecord[]>(
    [],
  );
  const [companyLogs, setCompanyLogs] = useState<AuditLog[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  }>({ key: "company_name", direction: "asc" });

  // --- 2. DERIVED DATA ---
  const globalAnalytics = useMemo(() => {
    const verifiedCount = companies.filter((c) => c.verified).length;
    const totalDailyRetirement = companies.reduce(
      (sum, c) => (c.verified ? sum + c.daily_usage : sum),
      0,
    );
    return {
      total: companies.length,
      verified: verifiedCount,
      suspended: companies.length - verifiedCount,
      totalDailyRetirement: totalDailyRetirement.toFixed(2),
    };
  }, [companies]);

  const filteredAndSortedCompanies = useMemo(() => {
    let processable = [...companies];
    if (statusFilter !== "all") {
      processable = processable.filter(
        (c) => String(c.verified) === statusFilter,
      );
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      processable = processable.filter(
        (c) =>
          c.company_name.toLowerCase().includes(term) ||
          c.pan?.toLowerCase().includes(term) ||
          c.owner_name?.toLowerCase().includes(term),
      );
    }
    processable.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      let comp = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comp = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comp = aVal - bVal;
      }
      return sortConfig.direction === "asc" ? comp : -comp;
    });
    return processable;
  }, [companies, searchTerm, statusFilter, sortConfig]);

  // --- 3. DATA FETCHING & EFFECTS ---
  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      toast.error("Failed to fetch companies");
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      fetchCompanies().finally(() => setLoading(false));
    }
    if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const fetchCompanyDetails = async (pan: string) => {
      if (!pan) return;
      setLoadingDetails(true);
      try {
        const [prodRes, logsRes] = await Promise.all([
          supabase
            .from("verified")
            .select("*")
            .eq("pan", pan)
            .order("created_at", { ascending: false }),
          supabase
            .from("audit_logs")
            .select("*")
            .or(`from_pan.eq.${pan},to_pan.eq.${pan}`)
            .order("created_at", { ascending: false }),
        ]);
        if (prodRes.error) throw prodRes.error;
        if (logsRes.error) throw logsRes.error;
        setCompanyProduction(prodRes.data || []);
        setCompanyLogs(logsRes.data || []);
      } catch (error: any) {
        toast.error(`Failed to fetch details: ${error.message}`);
      } finally {
        setLoadingDetails(false);
      }
    };
    if (selectedCompany?.pan) {
      fetchCompanyDetails(selectedCompany.pan);
    }
  }, [selectedCompany]);

  // --- 4. HANDLER FUNCTIONS ---
  const handleSort = (key: SortKey) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  const handleSelectCompany = (company: CompanyRecord) =>
    setSelectedCompany((prev) => (prev?.id === company.id ? null : company));
  const toggleCompanyStatus = async (company: CompanyRecord) => {
    const newStatus = !company.verified;
    const actionPast = newStatus ? "verified" : "suspended";
    setActionCompanyId(company.id);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ verified: newStatus })
        .eq("id", company.id);
      if (error) throw error;
      toast.success(`Company ${company.company_name} has been ${actionPast}.`);
      fetchCompanies();
    } catch (err: any) {
      toast.error(`Failed to update company status: ${err.message}`);
    } finally {
      setActionCompanyId(null);
    }
  };
  const handleRetireCredits = async () => {
    setIsRetiring(true);
    toast.info("Starting credit retirement for all verified companies...");
    try {
      const res = await fetch("/api/retire-daily-credits", { method: "POST" });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to run retirement process.");
      toast.success(
        `${data.message} Processed: ${data.summary.processed}, Succeeded: ${data.summary.successful}, Failed: ${data.summary.failed}.`,
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRetiring(false);
    }
  };

  // --- 5. CONDITIONAL RENDERING (GUARD CLAUSES) ---
  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (status === "unauthenticated" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Please log in as an admin to view this page.</p>
      </div>
    );
  }
  if (session.user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Access denied. This page is for administrators only.</p>
      </div>
    );
  }

  // --- 6. MAIN COMPONENT RENDER ---
  return (
    <div className="container mx-auto space-y-12 py-8">
      <section>
        <h2 className="mb-6 text-3xl font-bold tracking-tight">
          Admin Dashboard
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Companies"
            value={globalAnalytics.total}
            icon={Users}
          />
          <StatCard
            title="Verified Companies"
            value={globalAnalytics.verified}
            icon={CheckCircle}
          />
          <StatCard
            title="Suspended / Pending"
            value={globalAnalytics.suspended}
            icon={Ban}
          />
          <StatCard
            title="Total Daily Retirement (HC)"
            value={globalAnalytics.totalDailyRetirement}
            icon={Clock}
          />
        </div>
      </section>

      <section>
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-blue-600">
              <ShieldCheck className="h-6 w-6" />
              <span>System-Wide Actions</span>
            </CardTitle>
            <CardDescription>
              These actions affect all verified companies in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold">Manual Credit Retirement</h4>
            <p className="text-muted-foreground mb-4 text-sm">
              Trigger the retirement process for all verified companies based on
              their specified 'Daily Usage'.
            </p>
            <Button onClick={handleRetireCredits} disabled={isRetiring}>
              {isRetiring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRetiring
                ? "Processing Retirement..."
                : "Run Retirement Process"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold">Company Management</h2>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <div className="relative w-full md:w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search by name, PAN, owner..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardDescription className="mt-2 mb-4">
          Click on a company row to view its detailed history and transactions.
        </CardDescription>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("company_name")}
                  >
                    Company <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>PAN</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("owner_name")}
                  >
                    Owner <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("daily_usage")}
                  >
                    Daily Usage <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No companies match your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedCompanies.map((c) => (
                  <TableRow
                    key={c.id}
                    onClick={() => handleSelectCompany(c)}
                    className="hover:bg-muted/50 cursor-pointer"
                    data-state={
                      selectedCompany?.id === c.id ? "selected" : "unselected"
                    }
                  >
                    <TableCell className="font-medium">
                      {c.company_name}
                    </TableCell>
                    <TableCell className="font-mono">{c.pan || "-"}</TableCell>
                    <TableCell>{c.owner_name || "-"}</TableCell>
                    <TableCell className="text-center">
                      {c.daily_usage}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.verified ? "default" : "destructive"}>
                        {c.verified ? "Verified" : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={c.verified ? "destructive" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompanyStatus(c);
                        }}
                        disabled={actionCompanyId === c.id}
                      >
                        {actionCompanyId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : c.verified ? (
                          <>
                            <Ban className="mr-2 h-4 w-4" /> Suspend
                          </>
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {selectedCompany && (
        <section className="rounded-lg border bg-slate-50 p-6 shadow-sm dark:bg-slate-900/50">
          <h2 className="mb-6 text-2xl font-bold">
            Details for{" "}
            <span className="text-primary">{selectedCompany.company_name}</span>
          </h2>
          {loadingDetails ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              <CompanyProductionChart data={companyProduction} />
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                  <TrendingUp className="h-5 w-5" /> Production History
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>H₂ Produced (kg)</TableHead>
                        <TableHead>Power Used (KWh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyProduction.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center">
                            No verified production records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        companyProduction.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {new Date(p.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {p.hydrogen_produced.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {p.electricity_consumed.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                  <History className="h-5 w-5" /> Transaction History
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount (HC)</TableHead>
                        <TableHead>From/To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        companyLogs.map((log) => {
                          const isSent = log.from_pan === selectedCompany.pan;
                          return (
                            <TableRow key={log.id}>
                              <TableCell>
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={isSent ? "outline" : "default"}>
                                  {isSent ? "Sent" : "Received"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.amount}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {isSent
                                  ? `To: ${log.to_pan}`
                                  : `From: ${log.from_pan}`}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === "success"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                >
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{log.remarks}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
