"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import {
  Loader2,
  Wallet,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Coins,
  ShoppingCart,
  Store,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { supabase } from "~/lib/supabase";

// --- Form Schemas ---
const creditSchema = z.object({
  walletAddress: z
    .string()
    .min(42, "Invalid wallet address")
    .max(42, "Invalid wallet address"),
  hydrogenKg: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Must be a positive number",
    ),
});

const buySchema = z.object({
  credits: z
    .string()
    .min(1, "Credits amount is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Must be a positive number",
    ),
  cost: z
    .string()
    .min(1, "Cost is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      "Must be a non-negative number",
    ),
});

// --- Sell Schema (for confirmation dialog) ---
const sellSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Must be a positive number.",
  }),
});

// --- Interfaces ---
interface WalletInfo {
  pan: string;
  walletAddress: string;
  balance: string;
}

interface MarketplaceListing {
  id: string;
  credits: number;
  cost: number;
  buyer_wallet: string;
  buyer_pan: string;
  status: "open" | "completed" | "cancelled";
  created_at: string;
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

export default function TradeDashboard() {
  const { data: session } = useSession();
  const userPan = (session?.user as any)?.pan as string | undefined;

  // --- State Management ---
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  const [marketplaceListings, setMarketplaceListings] = useState<
    MarketplaceListing[]
  >([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);
  const [sellingTo, setSellingTo] = useState<string | null>(null);

  const [userLogs, setUserLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // --- Dialog States ---
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [listingToSell, setListingToSell] = useState<MarketplaceListing | null>(
    null,
  );

  // --- Forms ---
  const creditForm = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: { walletAddress: "", hydrogenKg: "" },
  });

  const buyForm = useForm<z.infer<typeof buySchema>>({
    resolver: zodResolver(buySchema),
    defaultValues: { credits: "", cost: "" },
  });

  const sellForm = useForm<z.infer<typeof sellSchema>>({
    resolver: zodResolver(sellSchema),
  });

  // --- Marketplace controls (filter/sort/paginate) ---
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "credits" | "cost">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // newest first by default
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // --- Data Fetching ---
  const fetchBalance = useCallback(async (pan: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/get-balance?pan=${pan}`);
      const data = await res.json();
      if (res.ok) {
        setWalletInfo({
          pan: data.pan,
          walletAddress: data.walletAddress,
          balance: data.balance,
        });
        setIsRegistered(true);
      } else {
        const createRes = await fetch("/api/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pan }),
        });
        if (createRes.ok) await fetchBalance(pan);
        else {
          setError(data.error || "Failed to fetch or create a wallet");
          setIsRegistered(false);
        }
      }
    } catch {
      setError("Network error - unable to connect to the blockchain");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMarketplace = useCallback(async () => {
    setLoadingMarketplace(true);
    try {
      const { data, error } = await supabase
        .from("marketplace")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false }); // newest first

      if (error) throw error;
      setMarketplaceListings((data || []) as MarketplaceListing[]);
    } catch (err: any) {
      setError(`Failed to fetch marketplace: ${err.message}`);
    } finally {
      setLoadingMarketplace(false);
    }
  }, []);

  const fetchUserLogs = useCallback(async (pan: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`from_pan.eq.${pan},to_pan.eq.${pan}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserLogs((data || []) as AuditLog[]);
    } catch (err: any) {
      setError(`Failed to fetch your transactions: ${err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // --- Handlers ---
  const handleCredit = async (values: z.infer<typeof creditSchema>) => {
    console.log("Crediting values:", values);
  };

  const handlePlaceBuyOrder = async (values: z.infer<typeof buySchema>) => {
    if (!walletInfo || !userPan) {
      setError("Wallet information is missing.");
      return;
    }
    setCrediting(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.from("marketplace").insert([
        {
          credits: Number(values.credits),
          cost: Number(values.cost),
          buyer_wallet: walletInfo.walletAddress,
          buyer_pan: userPan,
          status: "open",
        },
      ]);
      if (error) throw error;
      setSuccess("Successfully placed buy order!");
      setShowBuyDialog(false);
      buyForm.reset();
      await fetchMarketplace();
    } catch (err: any) {
      setError(`Failed to place order: ${err.message}`);
    } finally {
      setCrediting(false);
    }
  };

  const openSellConfirmation = (listing: MarketplaceListing) => {
    const userBalance = parseFloat(walletInfo?.balance || "0");
    if (userBalance < 1) {
      setError("You do not have enough credits to sell.");
      return;
    }
    setListingToSell(listing);
    // Default to selling the full requested amount or user's balance, whichever is smaller
    const amountToSell = Math.min(listing.credits, userBalance);
    sellForm.setValue("amount", String(amountToSell));
    setShowSellDialog(true);
  };

  const handleConfirmSell = async (values: z.infer<typeof sellSchema>) => {
    // --- MODIFICATION HERE ---
    // Ensure userPan is available before proceeding
    if (!walletInfo || !listingToSell || !userPan) {
      setError("Your wallet, the listing, or your user session is not loaded.");
      return;
    }
    // --- END MODIFICATION ---

    const amountToSell = Number(values.amount);
    if (amountToSell <= 0) {
      setError("Sell amount must be positive.");
      return;
    }
    if (amountToSell > parseFloat(walletInfo.balance)) {
      setError("You cannot sell more credits than you have.");
      return;
    }
    if (amountToSell > listingToSell.credits) {
      setError("You cannot sell more credits than the buyer requested.");
      return;
    }

    setSellingTo(listingToSell.id);
    setError("");
    setSuccess("");

    try {
      const transferRes = await fetch("/api/transfer-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // --- MODIFICATION HERE ---
        // Add fromPan and toPan to the body of the request
        body: JSON.stringify({
          fromWallet: walletInfo.walletAddress,
          toWallet: listingToSell.buyer_wallet,
          hydrogenKg: amountToSell,
          listingId: listingToSell.id,
          fromPan: userPan, // The current user's PAN
          toPan: listingToSell.buyer_pan, // The buyer's PAN from the listing
        }),
        // --- END MODIFICATION ---
      });

      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        throw new Error(transferData.error || "Blockchain transfer failed.");
      }

      setSuccess(`Successfully sold ${amountToSell} HC!`);
      setShowSellDialog(false);
      setListingToSell(null);

      if (userPan) {
        await fetchBalance(userPan);
        await fetchUserLogs(userPan); // This will now fetch the new log
      }
      await fetchMarketplace();
    } catch (err: any) {
      setError(err.message || "An error occurred during the sale.");
    } finally {
      setSellingTo(null);
    }
  };

  // ... (rest of the component)

  // --- Effects ---
  useEffect(() => {
    if (userPan) {
      fetchBalance(userPan);
      fetchMarketplace();
      fetchUserLogs(userPan);
    }
  }, [userPan, fetchBalance, fetchMarketplace, fetchUserLogs]);

  // --- Derived marketplace lists ---
  const myBuyOrders = useMemo(
    () =>
      marketplaceListings.filter((l) => l.buyer_pan === userPan) as
        | MarketplaceListing[]
        | [],
    [marketplaceListings, userPan],
  );

  const openOtherListings = useMemo(
    () =>
      marketplaceListings.filter((l) => l.buyer_pan !== userPan) as
        | MarketplaceListing[]
        | [],
    [marketplaceListings, userPan],
  );

  // Filter + sort
  const filteredSortedOtherListings = useMemo(() => {
    const filtered = openOtherListings.filter(
      (listing) =>
        listing.buyer_pan.toLowerCase().includes(search.toLowerCase()) ||
        listing.buyer_wallet.toLowerCase().includes(search.toLowerCase()),
    );

    const sorted = [...filtered].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortBy === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortBy === "credits") {
        valA = a.credits;
        valB = b.credits;
      } else {
        valA = a.cost;
        valB = b.cost;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      } else {
        return sortOrder === "asc"
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      }
    });

    return sorted;
  }, [openOtherListings, search, sortBy, sortOrder]);

  // Pagination (other users' listings)
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSortedOtherListings.length / pageSize),
  );
  const paginatedOtherListings = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    return filteredSortedOtherListings.slice(start, end);
  }, [filteredSortedOtherListings, page]);

  // reset page on filters changes
  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortOrder]);

  // Calculate remaining balance for sell confirmation dialog
  const sellAmount = sellForm.watch("amount");
  const remainingBalance =
    parseFloat(walletInfo?.balance || "0") - parseFloat(sellAmount || "0");

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border p-8">
        <div className="relative z-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Hydrogen Credits Trading</h1>
              <p className="text-muted-foreground mt-1">
                Manage your credits on the blockchain
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">
              <CheckCircle className="mr-1 h-3 w-3" />
              {session.user.email}
            </Badge>
            <Badge variant="outline">PAN: {userPan}</Badge>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <CheckCircle className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Wallet Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Wallet Overview</CardTitle>
                <CardDescription>
                  Your credits balance and wallet info
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => userPan && fetchBalance(userPan)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : walletInfo ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">
                <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Wallet className="h-4 w-4" />
                  <span>Wallet Address</span>
                </div>
                <p className="font-mono text-sm break-all">
                  {walletInfo.walletAddress}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">
                <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Coins className="h-4 w-4" />
                  <span>Available Balance</span>
                </div>
                <p className="font-mono text-2xl font-bold">
                  {walletInfo.balance} HC
                </p>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Wallet className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">No wallet data</h3>
              <p className="text-muted-foreground mb-4">
                Click refresh to load your wallet.
              </p>
              <Button
                onClick={() => userPan && fetchBalance(userPan)}
                disabled={loading}
                variant="outline"
              >
                Load Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Marketplace Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6" />
            <span>Marketplace Actions</span>
          </CardTitle>
          <CardDescription>
            Place a buy order to be listed on the marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowBuyDialog(true)} disabled={!walletInfo}>
            <Coins className="mr-2 h-4 w-4" /> I want to Buy Credits
          </Button>
        </CardContent>
      </Card>

      {/* Marketplace Listings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Store className="h-6 w-6" />
            <span>Marketplace</span>
          </CardTitle>
          <CardDescription>
            Newest orders show first by default. Your orders are separated
            below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* --- Controls --- */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by PAN or Wallet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:col-span-2"
            />
            <div className="flex items-center justify-end gap-2">
              <Select
                value={sortBy}
                onValueChange={(v: "created_at" | "credits" | "cost") =>
                  setSortBy(v)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest</SelectItem>
                  <SelectItem value="credits">Credits</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                }
                title="Toggle sort order"
              >
                {sortOrder === "asc" ? "Asc ↑" : "Desc ↓"}
              </Button>
            </div>
          </div>

          {/* --- My Buy Orders --- */}
          {myBuyOrders.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">My Buy Orders</Badge>
                <span className="text-muted-foreground text-sm">
                  (cannot sell to yourself)
                </span>
              </div>
              <div className="space-y-3">
                {myBuyOrders.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-muted/30 flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-bold">
                        {listing.credits} HC for ${listing.cost}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        Created: {new Date(listing.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">Your order</Badge>
                  </div>
                ))}
              </div>
              <div className="bg-border my-4 h-px w-full" />
            </div>
          )}

          {loadingMarketplace ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : paginatedOtherListings.length > 0 ? (
            <div className="space-y-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">Other Orders</Badge>
              </div>
              {paginatedOtherListings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-bold">
                      {listing.credits} HC for ${listing.cost}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      Buyer PAN: {listing.buyer_pan} •{" "}
                      {new Date(listing.created_at).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      Buyer Wallet: {listing.buyer_wallet.slice(0, 12)}...
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSellConfirmation(listing)}
                    disabled={
                      listing.buyer_wallet === walletInfo?.walletAddress ||
                      !!sellingTo
                    }
                  >
                    {sellingTo === listing.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Sell to this Buyer
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">
              No open buy orders from other users.
            </p>
          )}

          {/* --- Pagination --- */}
          {filteredSortedOtherListings.length > pageSize && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2 text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your Transactions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userLogs.length === 0 ? (
            <p className="text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {userLogs.map((log) => {
                const isSent = log.from_pan === userPan;
                return (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      log.status === "success"
                        ? "bg-green-50 dark:bg-green-950/20"
                        : "bg-red-50 dark:bg-red-950/20"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={isSent ? "default" : "secondary"}>
                          {isSent ? "Sent" : "Received"}
                        </Badge>
                        <span className="text-sm">
                          {isSent ? (
                            <>
                              To <span className="font-mono">{log.to_pan}</span>
                            </>
                          ) : (
                            <>
                              From{" "}
                              <span className="font-mono">{log.from_pan}</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-sm">
                        Amount:{" "}
                        <span className="font-semibold">{log.amount}</span> HC
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(log.created_at).toLocaleString()} •{" "}
                        {log.status}
                        {log.tx_hash
                          ? ` • tx: ${log.tx_hash.slice(0, 10)}…`
                          : ""}
                        {log.remarks ? ` • ${log.remarks}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Sale</DialogTitle>
            <DialogDescription>
              You are selling to{" "}
              <span className="font-mono">{listingToSell?.buyer_pan}</span>.
              Please confirm the amount to sell.
            </DialogDescription>
          </DialogHeader>
          <Form {...sellForm}>
            <form
              onSubmit={sellForm.handleSubmit(handleConfirmSell)}
              className="space-y-4"
            >
              <div className="rounded-md border p-4">
                <p className="text-sm">
                  Buyer wants:{" "}
                  <span className="font-bold">{listingToSell?.credits} HC</span>
                </p>
                <p className="text-sm">
                  Your balance:{" "}
                  <span className="font-bold">
                    {walletInfo?.balance || "0"} HC
                  </span>
                </p>
              </div>

              <FormField
                control={sellForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Sell (HC)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-md border bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20">
                <p className="text-sm font-semibold">
                  After this sale, your new balance will be:
                </p>
                <p className="text-lg font-bold">
                  {isNaN(remainingBalance)
                    ? "..."
                    : `${remainingBalance.toFixed(2)} HC`}
                </p>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSellDialog(false)}
                  disabled={!!sellingTo}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!!sellingTo}>
                  {sellingTo && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {sellingTo ? "Processing..." : "Confirm & Sell"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* DIALOGS */}
      {/* Buy Order Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Place a Buy Order
            </DialogTitle>
            <DialogDescription>
              Declare your intent to buy credits. This will be visible to other
              users.
            </DialogDescription>
          </DialogHeader>
          <Form {...buyForm}>
            <form
              onSubmit={buyForm.handleSubmit(handlePlaceBuyOrder)}
              className="space-y-4"
            >
              <FormField
                control={buyForm.control}
                name="credits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credits to Buy (HC)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        placeholder="e.g., 500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={buyForm.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g., 100.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBuyDialog(false)}
                  disabled={crediting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={crediting}>
                  {crediting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {crediting ? "Submitting..." : "Place Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Credit Tokens Dialog (Admin Function) */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Credit Tokens
            </DialogTitle>
            <DialogDescription>
              Add hydrogen credits to a wallet address (admin function).
            </DialogDescription>
          </DialogHeader>
          <Form {...creditForm}>
            <form
              onSubmit={creditForm.handleSubmit(handleCredit)}
              className="space-y-4"
            >
              <FormField
                control={creditForm.control}
                name="walletAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Wallet Address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={creditForm.control}
                name="hydrogenKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hydrogen Amount (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreditDialog(false)}
                  disabled={crediting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={crediting}>
                  {crediting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {crediting ? "Processing..." : "Credit Tokens"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
