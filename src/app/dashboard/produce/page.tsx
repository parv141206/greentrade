"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  BarChart3,
  Calculator,
  CheckCircle,
  Fuel,
  Loader2,
  TableIcon,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "~/lib/supabase";
import { useSession } from "next-auth/react";
import { useIsMobile } from "~/hooks/use-mobile";

const formSchema = z.object({
  hydrogenProduced: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Must be positive",
    ),
  electricityConsumed: z
    .string()
    .min(1, "Electricity consumed is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Must be positive",
    ),
});

interface HydrogenRecord {
  id: string;
  pan: string;
  gst: string;
  hydrogen_produced: number;
  electricity_consumed: number;
  created_at: string;
  verified: boolean;
}

const chartConfig = {
  hydrogen: {
    label: "Hydrogen Produced (kg)",
    color: "hsl(var(--foreground))",
  },
  electricity: {
    label: "Electricity Consumed (kWh)",
    color: "hsl(var(--muted-foreground))",
  },
  efficiency: {
    label: "Efficiency (kg/kWh)",
    color: "hsl(var(--border))",
  },
} satisfies ChartConfig;

export default function ProduceDashboard() {
  // Mock session data for demo
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<HydrogenRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<z.infer<
    typeof formSchema
  > | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [timeRange, setTimeRange] = useState("30d");
  const isMobile = useIsMobile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hydrogenProduced: "",
      electricityConsumed: "",
    },
  });

  const fetchRecords = async () => {
    if (!session?.user?.pan) return;

    setLoading(true);
    try {
      const [unverified, verified] = await Promise.all([
        supabase
          .from("unverified")
          .select("*")
          .eq("pan", session.user.pan)
          .order("created_at", { ascending: false }),
        supabase
          .from("verified")
          .select("*")
          .eq("pan", session.user.pan)
          .order("created_at", { ascending: false }),
      ]);

      const combined = [
        ...(unverified.data || []).map((r) => ({ ...r, verified: false })),
        ...(verified.data || []).map((r) => ({ ...r, verified: true })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setRecords(combined);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.pan) fetchRecords();
  }, [session]);

  useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  // Prepare chart data
  const getFilteredChartData = () => {
    const now = new Date();
    let daysToSubtract = 30;
    if (timeRange === "7d") daysToSubtract = 7;
    else if (timeRange === "90d") daysToSubtract = 90;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return records
      .filter((record) => new Date(record.created_at) >= startDate)
      .map((record) => ({
        date: record.created_at,
        hydrogen: record.hydrogen_produced,
        electricity: record.electricity_consumed,
        efficiency: Number(
          (record.hydrogen_produced / record.electricity_consumed).toFixed(4),
        ),
        verified: record.verified,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const chartData = getFilteredChartData();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setPendingFormData(values);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingFormData || !session?.user?.pan || !session?.user?.gst) {
      toast.error("User authentication data not available");
      return;
    }

    setSubmitting(true);
    setShowConfirmDialog(false);

    try {
      const { data, error } = await supabase.from("unverified").insert([
        {
          pan: session.user.pan,
          gst: session.user.gst,
          hydrogen_produced: Number(pendingFormData.hydrogenProduced),
          electricity_consumed: Number(pendingFormData.electricityConsumed),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success("Data submitted successfully");
      form.reset();
      fetchRecords();
      setPendingFormData(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit data");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-8 dark:border-gray-800 dark:from-gray-950 dark:via-slate-950 dark:to-zinc-950">
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
              <Fuel className="h-6 w-6" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-black bg-clip-text text-3xl font-bold text-transparent dark:from-gray-100 dark:to-white">
                Hydrogen Production Data
              </h1>
              <p className="text-muted-foreground mt-1">
                Track and monitor your hydrogen production metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            >
              <CheckCircle className="h-3 w-3" />
              {session.user.email}
            </Badge>
            <Badge
              variant="outline"
              className="border-gray-300 dark:border-gray-700"
            >
              PAN: {session.user.pan}
            </Badge>
          </div>
        </div>
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gray-200/30 dark:bg-gray-800/30"></div>
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-zinc-200/30 dark:bg-zinc-800/30"></div>
      </div>

      {/* Enhanced Form */}
      <Card className="relative overflow-hidden border-gray-200 dark:border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/50 to-slate-50/50 dark:from-gray-950/50 dark:to-slate-950/50"></div>
        <CardHeader className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Submit New Production Data
              </CardTitle>
              <CardDescription>
                Record your latest hydrogen production and electricity
                consumption
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hydrogenProduced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-semibold">
                        <Fuel className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        Hydrogen Produced (kg)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          className="h-12 border-gray-300 text-lg font-medium transition-all focus:ring-2 focus:ring-gray-500/20 dark:border-gray-700"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Enter the amount of hydrogen produced in kilograms
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="electricityConsumed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-semibold">
                        <Zap className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        Electricity Consumed (kWh)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          className="h-12 border-gray-300 text-lg font-medium transition-all focus:ring-2 focus:ring-gray-500/20 dark:border-gray-700"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Enter the electricity consumed in kilowatt-hours
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Live Efficiency Calculation */}
              {form.watch("hydrogenProduced") &&
                form.watch("electricityConsumed") && (
                  <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-2 flex items-center gap-2">
                      <Calculator className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">
                        Calculated Efficiency
                      </span>
                    </div>
                    <p className="text-foreground text-2xl font-bold">
                      {(
                        Number(form.watch("hydrogenProduced")) /
                        Number(form.watch("electricityConsumed"))
                      ).toFixed(4)}{" "}
                      kg/kWh
                    </p>
                  </div>
                )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full bg-black text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-gray-800 hover:shadow-xl dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {submitting ? "Submitting..." : "Submit Production Data"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-gray-300 sm:max-w-md dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              Confirm Data Submission
            </DialogTitle>
            <DialogDescription>
              Please review your data before submitting. This will be recorded
              as unverified until reviewed.
            </DialogDescription>
          </DialogHeader>

          {pendingFormData && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-1 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium">Hydrogen</span>
                  </div>
                  <p className="text-xl font-bold">
                    {pendingFormData.hydrogenProduced} kg
                  </p>
                </div>
                <div className="rounded-lg border border-gray-300 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-1 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium">Electricity</span>
                  </div>
                  <p className="text-xl font-bold">
                    {pendingFormData.electricityConsumed} kWh
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-gray-400 bg-gray-100 p-3 dark:border-gray-600 dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  <span className="text-sm font-medium">
                    Calculated Efficiency
                  </span>
                </div>
                <p className="text-xl font-bold">
                  {(
                    Number(pendingFormData.hydrogenProduced) /
                    Number(pendingFormData.electricityConsumed)
                  ).toFixed(4)}{" "}
                  kg/kWh
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitting}
              className="border-gray-300 dark:border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Data Visualization */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Overview</CardTitle>
              <CardDescription>
                Hydrogen production and electricity consumption trends
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* View Toggle */}
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) =>
                  value && setViewMode(value as "chart" | "table")
                }
                variant="outline"
                className="hidden md:flex"
              >
                <ToggleGroupItem
                  value="chart"
                  className="flex items-center gap-2 data-[state=on]:bg-gray-900 data-[state=on]:text-white dark:data-[state=on]:bg-gray-100 dark:data-[state=on]:text-black"
                >
                  <BarChart3 className="h-4 w-4" />
                  Chart
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="table"
                  className="flex items-center gap-2 data-[state=on]:bg-gray-900 data-[state=on]:text-white dark:data-[state=on]:bg-gray-100 dark:data-[state=on]:text-black"
                >
                  <TableIcon className="h-4 w-4" />
                  Table
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Time Range Toggle */}
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={setTimeRange}
                variant="outline"
                className="hidden lg:flex"
              >
                <ToggleGroupItem
                  value="90d"
                  className="data-[state=on]:bg-gray-900 data-[state=on]:text-white dark:data-[state=on]:bg-gray-100 dark:data-[state=on]:text-black"
                >
                  Last 3 months
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="30d"
                  className="data-[state=on]:bg-gray-900 data-[state=on]:text-white dark:data-[state=on]:bg-gray-100 dark:data-[state=on]:text-black"
                >
                  Last 30 days
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="7d"
                  className="data-[state=on]:bg-gray-900 data-[state=on]:text-white dark:data-[state=on]:bg-gray-100 dark:data-[state=on]:text-black"
                >
                  Last 7 days
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Mobile Selects */}
              <div className="flex gap-2 md:hidden">
                <Select
                  value={viewMode}
                  onValueChange={(value) =>
                    setViewMode(value as "chart" | "table")
                  }
                >
                  <SelectTrigger className="w-24 border-gray-300 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gray-300 dark:border-gray-700">
                    <SelectItem value="chart">Chart</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32 border-gray-300 lg:hidden dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-300 dark:border-gray-700">
                  <SelectItem value="90d">3 months</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : viewMode === "chart" ? (
            <div className="space-y-4">
              {chartData.length > 0 ? (
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[300px] w-full"
                >
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="fillHydrogen"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--foreground))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--foreground))"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                      <linearGradient
                        id="fillElectricity"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--muted-foreground))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--muted-foreground))"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={60}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => {
                            return new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                          }}
                          indicator="dot"
                          formatter={(value, name) => {
                            if (name === "hydrogen")
                              return [
                                `${Number(value).toFixed(2)} kg`,
                                "Hydrogen",
                              ];
                            if (name === "electricity")
                              return [
                                `${Number(value).toFixed(2)} kWh`,
                                "Electricity",
                              ];
                            if (name === "efficiency")
                              return [
                                `${Number(value).toFixed(4)} kg/kWh`,
                                "Efficiency",
                              ];
                            return [value, name];
                          }}
                        />
                      }
                    />
                    <Area
                      dataKey="hydrogen"
                      type="natural"
                      fill="url(#fillHydrogen)"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      dot={{
                        fill: "hsl(var(--foreground))",
                        strokeWidth: 2,
                        r: 4,
                      }}
                      activeDot={{
                        r: 6,
                        stroke: "hsl(var(--foreground))",
                        strokeWidth: 2,
                        fill: "hsl(var(--background))",
                      }}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="text-muted-foreground mb-4 h-12 w-12" />
                  <h3 className="text-lg font-semibold">No data available</h3>
                  <p className="text-muted-foreground">
                    Submit your first production data to see the chart
                  </p>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-800">
                  <TableHead>Date</TableHead>
                  <TableHead>Hydrogen (kg)</TableHead>
                  <TableHead>Electricity (kWh)</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length > 0 ? (
                  records.map((r) => (
                    <TableRow
                      key={r.id}
                      className="border-gray-200 dark:border-gray-800"
                    >
                      <TableCell>
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.hydrogen_produced.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.electricity_consumed.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {(r.hydrogen_produced / r.electricity_consumed).toFixed(
                          4,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            r.verified
                              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-black"
                              : "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                          }
                        >
                          {r.verified ? "Verified" : "Unverified"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <TableIcon className="text-muted-foreground h-8 w-8" />
                        <span className="text-muted-foreground">
                          No records found
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Total Hydrogen</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {records
                  .reduce((sum, r) => sum + r.hydrogen_produced, 0)
                  .toFixed(2)}{" "}
                kg
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Total Electricity</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {records
                  .reduce((sum, r) => sum + r.electricity_consumed, 0)
                  .toFixed(2)}{" "}
                kWh
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Avg Efficiency</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {(
                  records.reduce(
                    (sum, r) =>
                      sum + r.hydrogen_produced / r.electricity_consumed,
                    0,
                  ) / records.length
                ).toFixed(4)}{" "}
                kg/kWh
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Verified Records</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {records.filter((r) => r.verified).length} / {records.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}
