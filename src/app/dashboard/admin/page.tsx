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

interface CompanyRecord {
  id: string;
  company_name: string;
  pan: string | null;
  gst: string | null;
  email: string;
  verified: boolean;
  created_at: string;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const [hydrogenRecords, setHydrogenRecords] = useState<HydrogenRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingCompanyId, setVerifyingCompanyId] = useState<string | null>(
    null,
  );

  const fetchHydrogenRecords = async () => {
    try {
      setLoading(true);
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

      setHydrogenRecords(combined);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch hydrogen records");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCompanies(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchHydrogenRecords();
      fetchCompanies();
    }
  }, [session]);

  // ----------------- REGISTER & CREDIT BLOCKCHAIN -----------------
  const registerAndCreditBlockchain = async (
    pan: string,
    hydrogenKg: number,
  ) => {
    try {
      console.log("Calling create-user API with PAN:", pan);

      // Step 1: Ensure user is created/registered
      const resCreate = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pan }),
      });

      if (!resCreate.ok) {
        const errorData = await resCreate.json();
        throw new Error(
          errorData.error ||
            `HTTP ${resCreate.status}: ${resCreate.statusText}`,
        );
      }

      const createData = await resCreate.json();
      console.log("User created/verified:", createData);

      const walletAddress = createData.walletAddress;
      if (!walletAddress)
        throw new Error("No walletAddress returned from create-user");

      // Step 2: Credit tokens for this user
      console.log(
        "Calling credit-tokens API with wallet:",
        walletAddress,
        "amount:",
        hydrogenKg,
      );
      const resCredit = await fetch("/api/credit-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, hydrogenKg }),
      });

      if (!resCredit.ok) {
        const errorData = await resCredit.json();
        throw new Error(
          errorData.error ||
            `HTTP ${resCredit.status}: ${resCredit.statusText}`,
        );
      }

      const creditData = await resCredit.json();
      console.log("Tokens credited:", creditData);

      return {
        ...createData,
        ...creditData,
      };
    } catch (err: any) {
      console.error("Blockchain operation failed:", err);
      throw err;
    }
  };

  // ----------------- VERIFY HYDROGEN -----------------
  const verifyHydrogen = async (record: HydrogenRecord) => {
    if (!record || record.verified) return;
    setVerifyingId(record.id);

    try {
      console.log("Starting verification for record:", record.id);

      // First, register user and credit tokens on blockchain
      const blockchainResult = await registerAndCreditBlockchain(
        record.pan,
        record.hydrogen_produced,
      );

      console.log("Blockchain operation completed:", blockchainResult);

      // If blockchain operation succeeds, update database
      const { error: delErr } = await supabase
        .from("unverified")
        .delete()
        .eq("id", record.id);

      if (delErr) {
        console.error("Database delete error:", delErr);
        throw new Error(`Failed to delete from unverified: ${delErr.message}`);
      }

      const { error: insertErr } = await supabase.from("verified").insert([
        {
          pan: record.pan,
          gst: record.gst,
          hydrogen_produced: record.hydrogen_produced,
          electricity_consumed: record.electricity_consumed,
          created_at: record.created_at,
        },
      ]);

      if (insertErr) {
        console.error("Database insert error:", insertErr);
        throw new Error(`Failed to insert into verified: ${insertErr.message}`);
      }

      toast.success(
        `✅ Record verified! ${record.hydrogen_produced} H₂ tokens credited. Balance: ${blockchainResult.currentBalance} (was: ${blockchainResult.initialBalance})`,
      );

      fetchHydrogenRecords();
    } catch (err: any) {
      console.error("Verification error:", err);

      // Provide user-friendly error messages
      let errorMessage = "Verification failed";
      if (err.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient ETH for gas fees";
      } else if (err.message?.includes("execution reverted")) {
        errorMessage = "Smart contract rejected the transaction";
      } else if (err.message?.includes("missing revert data")) {
        errorMessage = "Contract function call failed";
      } else if (err.message?.includes("network")) {
        errorMessage = "Network connection error";
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setVerifyingId(null);
    }
  };

  // ----------------- VERIFY COMPANY -----------------
  const verifyCompany = async (company: CompanyRecord) => {
    if (!company || company.verified) return;
    setVerifyingCompanyId(company.id);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ verified: true })
        .eq("id", company.id);
      if (error) throw error;

      toast.success("Company verified!");
      fetchCompanies();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to verify company");
    } finally {
      setVerifyingCompanyId(null);
    }
  };

  if (status === "loading" || loading) {
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
    <div className="container mx-auto space-y-12 py-8">
      <section>
        <h2 className="mb-6 text-2xl font-bold">Hydrogen Records</h2>
        <div className="mb-4 rounded-lg bg-blue-50 p-4">
          <p className="text-sm text-blue-700">
            <strong>Info:</strong> Verifying a record will register the user on
            blockchain using their PAN number and credit their hydrogen tokens.
          </p>
        </div>
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
            {hydrogenRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No hydrogen records found
                </TableCell>
              </TableRow>
            ) : (
              hydrogenRecords.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.pan}</TableCell>
                  <TableCell className="font-mono text-sm">{r.gst}</TableCell>
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
                        onClick={() => verifyHydrogen(r)}
                        disabled={verifyingId === r.id}
                      >
                        {verifyingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Verify & Credit"
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">
          Companies Pending Verification
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>PAN</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">
                  No companies found
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.company_name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {c.pan || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {c.gst || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        c.verified
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {c.verified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!c.verified && (
                      <Button
                        size="sm"
                        onClick={() => verifyCompany(c)}
                        disabled={verifyingCompanyId === c.id}
                      >
                        {verifyingCompanyId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Verify Company"
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
