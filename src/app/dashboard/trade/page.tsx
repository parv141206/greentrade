"use client";
import React, { useEffect, useState, useCallback } from "react";
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
  FormDescription,
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
// Make sure this path is correct for your project structure
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
}

export default function TradeDashboard() {
  const { data: session } = useSession();

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

  // --- Dialog States ---
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  // --- Forms ---
  const creditForm = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: { walletAddress: "", hydrogenKg: "" },
  });

  const buyForm = useForm<z.infer<typeof buySchema>>({
    resolver: zodResolver(buySchema),
    defaultValues: { credits: "", cost: "" },
  });

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
    } catch (err) {
      setError("Network error - unable to connect to the blockchain");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- This is the function that is failing due to your Supabase config ---
  const fetchMarketplace = useCallback(async () => {
    setLoadingMarketplace(true);
    try {
      // The code correctly asks for a table named "marketplace".
      // Please ensure this table exists and is accessible in your Supabase project.
      const { data, error } = await supabase
        .from("marketplace") // <--- THIS LINE IS THE SOURCE OF THE ERROR
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMarketplaceListings(data || []);
    } catch (err: any) {
      setError(`Failed to fetch marketplace: ${err.message}`); // The error you see is generated here
    } finally {
      setLoadingMarketplace(false);
    }
  }, []);

  // --- Handlers ---
  const handleCredit = async (values: z.infer<typeof creditSchema>) => {
    console.log("Crediting values:", values);
  };

  const handlePlaceBuyOrder = async (values: z.infer<typeof buySchema>) => {
    if (!walletInfo || !session?.user.pan) {
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
          buyer_pan: session.user.pan,
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

  const handleSell = async (listing: MarketplaceListing) => {
    if (!walletInfo) {
      setError("Your wallet is not loaded. Cannot initiate sale.");
      return;
    }
    setSellingTo(listing.id);
    setError("");
    setSuccess("");
    try {
      const transferRes = await fetch("/api/transfer-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWallet: walletInfo.walletAddress,
          toWallet: listing.buyer_wallet,
          hydrogenKg: listing.credits,
        }),
      });
      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        throw new Error(transferData.error || "Blockchain transfer failed.");
      }
      const { error: updateError } = await supabase
        .from("marketplace")
        .update({ status: "completed" })
        .eq("id", listing.id);
      if (updateError) {
        throw new Error(
          `DB update failed after transfer: ${updateError.message}`,
        );
      }
      setSuccess(`Successfully sold ${listing.credits} HC!`);
      await fetchBalance(session!.user.pan);
      await fetchMarketplace();
    } catch (err: any) {
      setError(err.message || "An error occurred during the sale.");
    } finally {
      setSellingTo(null);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (session?.user?.pan) {
      fetchBalance(session.user.pan);
      fetchMarketplace();
    }
  }, [session, fetchBalance, fetchMarketplace]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">You must be logged in to view this page.</p>
      </div>
    );
  }

  // --- Render Logic (JSX) ---
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
            <Badge variant="outline">PAN: {session.user.pan}</Badge>
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
              onClick={() => fetchBalance(session.user.pan)}
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
                onClick={() => fetchBalance(session.user.pan)}
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
            Sell your credits to fulfill an open buy order from another user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMarketplace ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : marketplaceListings.length > 0 ? (
            <div className="space-y-4">
              {marketplaceListings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="font-bold">
                      {listing.credits} HC for ${listing.cost}
                    </p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Buyer: {listing.buyer_wallet.slice(0, 12)}...
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSell(listing)}
                    disabled={
                      listing.buyer_wallet === walletInfo?.walletAddress ||
                      !!sellingTo
                    }
                  >
                    {sellingTo === listing.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {sellingTo === listing.id
                      ? "Processing..."
                      : "Sell to this Buyer"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">
              No open buy orders in the marketplace.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Summary */}
      {walletInfo && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Wallet Status</CardDescription>
              <CardTitle className="text-lg">
                {isRegistered ? "Registered" : "Unregistered"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Balance</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {walletInfo.balance} HC
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Network</CardDescription>
              <CardTitle className="text-lg">Ganache Local</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

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
