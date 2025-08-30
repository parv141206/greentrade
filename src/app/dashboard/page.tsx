"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "~/lib/supabase";
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
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

export default function HydrogenDataPage() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<HydrogenRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!session?.user?.pan || !session?.user?.gst) {
      toast.error("User authentication data not available");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("unverified").insert([
        {
          pan: session.user.pan,
          gst: session.user.gst,
          hydrogen_produced: Number(values.hydrogenProduced),
          electricity_consumed: Number(values.electricityConsumed),
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success("Data submitted successfully");
      form.reset();
      fetchRecords();
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
      <h1 className="text-3xl font-bold">Hydrogen Production Data</h1>
      <p className="text-muted-foreground">
        Welcome, {session.user.email} (PAN: {session.user.pan})
      </p>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Submit New Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hydrogenProduced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hydrogen Produced (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="electricityConsumed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Electricity Consumed (KWh)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Data
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Submitted Data</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hydrogen (kg)</TableHead>
                  <TableHead>Electricity (KWh)</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{r.hydrogen_produced.toFixed(2)}</TableCell>
                    <TableCell>{r.electricity_consumed.toFixed(2)}</TableCell>
                    <TableCell>
                      {(r.hydrogen_produced / r.electricity_consumed).toFixed(
                        4,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.verified
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {r.verified ? "Verified" : "Unverified"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
