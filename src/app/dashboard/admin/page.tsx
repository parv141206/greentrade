"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";

interface HydrogenRecord {
  id: string;
  pan: string;
  gst: string;
  hydrogen_produced: number;
  electricity_consumed: number;
  created_at: string;
  verified: boolean;
}

export default function AdminHydrogenPage() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<HydrogenRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [unverifiedRes, verifiedRes] = await Promise.all([
        supabase
          .from("unverified")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("verified")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (unverifiedRes.error) throw unverifiedRes.error;
      if (verifiedRes.error) throw verifiedRes.error;

      const combined = [
        ...(unverifiedRes.data || []).map((r) => ({ ...r, verified: false })),
        ...(verifiedRes.data || []).map((r) => ({ ...r, verified: true })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setRecords(combined);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchRecords();
  }, [session]);

  const verifyRecord = async (record: HydrogenRecord) => {
    if (!record || record.verified) return;

    setVerifyingId(record.id);
    try {
      // 1️⃣ Delete from unverified table FIRST
      console.log(record.id);
      const { error: deleteError } = await supabase
        .from("unverified")
        .delete()
        .eq("id", record.id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      // 2️⃣ Insert into verified table
      const { error: insertError } = await supabase.from("verified").insert([
        {
          pan: record.pan,
          gst: record.gst,
          hydrogen_produced: record.hydrogen_produced,
          electricity_consumed: record.electricity_consumed,
          created_at: record.created_at,
        },
      ]);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
      await fetch("/api/credit-hydrogen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pan: record.pan,
          hydrogenKg: record.hydrogen_produced,
        }),
      });

      toast.success("Record verified successfully");
      fetchRecords();
    } catch (err: any) {
      console.error("Verify error:", err);
      toast.error(err.message || "Failed to verify record");
    } finally {
      setVerifyingId(null);
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
        <p>Please log in as admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Admin: Verify Hydrogen Data</h1>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Hydrogen (kg)</TableHead>
              <TableHead>Electricity (KWh)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {new Date(r.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{r.pan}</TableCell>
                <TableCell>{r.gst}</TableCell>
                <TableCell>{r.hydrogen_produced.toFixed(2)}</TableCell>
                <TableCell>{r.electricity_consumed.toFixed(2)}</TableCell>
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
                <TableCell>
                  {!r.verified && (
                    <Button
                      size="sm"
                      onClick={() => verifyRecord(r)}
                      disabled={verifyingId === r.id}
                    >
                      {verifyingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
