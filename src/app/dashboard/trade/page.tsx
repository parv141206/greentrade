"use client";

import React, { useEffect, useState } from "react";
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
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Coins,
  UserPlus,
  ArrowRightLeft,
} from "lucide-react";
import { useSession } from "next-auth/react";

// Form schemas
const transferSchema = z.object({
  toWallet: z
    .string()
    .min(42, "Invalid wallet address")
    .max(42, "Invalid wallet address"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Must be positive",
    ),
});

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
      "Must be positive",
    ),
});

interface WalletInfo {
  pan: string;
  walletAddress: string;
  balance: string;
}

export default function TradeDashboard() {
  // Mock session - replace with useSession() in real app
  const { data: session, status } = useSession();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      toWallet: "",
      amount: "",
    },
  });

  const creditForm = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: {
      walletAddress: "",
      hydrogenKg: "",
    },
  });

  const fetchBalance = async (pan: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
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
        setError(data.error || "Failed to fetch balance");
        setWalletInfo(null);
        // If balance fetch fails, wallet might not be registered
        setIsRegistered(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error - unable to connect to blockchain");
      setWalletInfo(null);
      setIsRegistered(false);
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async () => {
    if (!walletInfo?.walletAddress) return;

    setRegistering(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/register-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: walletInfo.walletAddress,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("User registered successfully!");
        setIsRegistered(true);
        await fetchBalance(session.user.pan);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error during registration");
    } finally {
      setRegistering(false);
    }
  };

  const handleTransfer = async (values: z.infer<typeof transferSchema>) => {
    if (!walletInfo || Number(values.amount) > Number(walletInfo.balance)) {
      setError("Insufficient balance");
      return;
    }

    setTransferring(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/transfer-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromWallet: walletInfo.walletAddress,
          toWallet: values.toWallet,
          hydrogenKg: Number(values.amount),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(
          `Successfully transferred ${values.amount} HC to ${values.toWallet.slice(0, 8)}...`,
        );
        setShowTransferDialog(false);
        transferForm.reset();
        // Refresh balance
        await fetchBalance(session.user.pan);
      } else {
        setError(data.error || "Transfer failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error during transfer");
    } finally {
      setTransferring(false);
    }
  };

  const handleCredit = async (values: z.infer<typeof creditSchema>) => {
    setCrediting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/credit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: values.walletAddress,
          hydrogenKg: Number(values.hydrogenKg),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(
          `Successfully credited ${values.hydrogenKg} HC to ${values.walletAddress.slice(0, 8)}...`,
        );
        setShowCreditDialog(false);
        creditForm.reset();
        if (values.walletAddress === walletInfo?.walletAddress) {
          await fetchBalance(session.user.pan);
        }
      } else {
        setError(data.error || "Credit operation failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error during credit operation");
    } finally {
      setCrediting(false);
    }
  };

  useEffect(() => {
    if (session?.user?.pan) {
      fetchBalance(session.user.pan);
    }
  }, []);
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">You must be logged in to view this page.</p>
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
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-black bg-clip-text text-3xl font-bold text-transparent dark:from-gray-100 dark:to-white">
                Hydrogen Credits Trading
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your hydrogen production credits on the blockchain
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

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          <CheckCircle className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Wallet Balance Card */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Wallet Overview</CardTitle>
                <CardDescription>
                  Your hydrogen credits balance and wallet information
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBalance(session.user.pan)}
              disabled={loading}
              className="border-gray-300 dark:border-gray-700"
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-2 flex items-center gap-2">
                    <Wallet className="text-muted-foreground h-4 w-4" />
                    <span className="text-muted-foreground text-sm font-medium">
                      Wallet Address
                    </span>
                  </div>
                  <p className="font-mono text-sm break-all">
                    {walletInfo.walletAddress}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-2 flex items-center gap-2">
                    <Coins className="text-muted-foreground h-4 w-4" />
                    <span className="text-muted-foreground text-sm font-medium">
                      Available Balance
                    </span>
                  </div>
                  <p className="font-mono text-2xl font-bold">
                    {walletInfo.balance} HC
                  </p>
                </div>
              </div>

              {!isRegistered && (
                <div className="flex items-center gap-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/50">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Wallet not registered for trading
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Register your wallet to enable token transfers
                    </p>
                  </div>
                  <Button
                    onClick={registerUser}
                    disabled={registering}
                    size="sm"
                    className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    {registering && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {registering ? "Registering..." : "Register"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Wallet className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">No wallet data</h3>
                <p className="text-muted-foreground mb-4">
                  Click refresh to load your wallet information
                </p>
                <Button
                  onClick={() => fetchBalance(session.user.pan)}
                  disabled={loading}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-700"
                >
                  Load Wallet
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Actions */}
      {walletInfo && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-gray-200 transition-shadow hover:shadow-lg dark:border-gray-800">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <CardTitle className="text-lg">Transfer Credits</CardTitle>
              </div>
              <CardDescription>
                Send hydrogen credits to another wallet address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={() => setShowTransferDialog(true)}
                disabled={!isRegistered || Number(walletInfo.balance) === 0}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Credits
              </Button>
            </CardContent>
          </Card>

          <Card className="border-gray-200 transition-shadow hover:shadow-lg dark:border-gray-800">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                <CardTitle className="text-lg">Credit Tokens</CardTitle>
              </div>
              <CardDescription>
                Add hydrogen credits to any wallet (admin function)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-gray-300 dark:border-gray-700"
                onClick={() => setShowCreditDialog(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Credit Tokens
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="border-gray-300 sm:max-w-md dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              Transfer Credits
            </DialogTitle>
            <DialogDescription>
              Send hydrogen credits to another wallet address
            </DialogDescription>
          </DialogHeader>

          <Form {...transferForm}>
            <div className="space-y-4">
              <FormField
                control={transferForm.control}
                name="toWallet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Wallet Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0x..."
                        className="border-gray-300 font-mono text-sm dark:border-gray-700"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Enter the 42-character wallet address (0x...)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={transferForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (HC)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        placeholder="0.00"
                        className="border-gray-300 dark:border-gray-700"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Available balance: {walletInfo?.balance || "0"} HC
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTransferDialog(false)}
                  disabled={transferring}
                  className="flex-1 border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={transferForm.handleSubmit(handleTransfer)}
                  disabled={transferring}
                  className="flex-1 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  {transferring && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {transferring ? "Transferring..." : "Transfer"}
                </Button>
              </div>
            </div>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Credit Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="border-gray-300 sm:max-w-md dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              Credit Tokens
            </DialogTitle>
            <DialogDescription>
              Add hydrogen credits to a wallet address (admin function)
            </DialogDescription>
          </DialogHeader>

          <Form {...creditForm}>
            <div className="space-y-4">
              <FormField
                control={creditForm.control}
                name="walletAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Wallet Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0x..."
                        className="border-gray-300 font-mono text-sm dark:border-gray-700"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Enter the wallet address to credit tokens to
                    </FormDescription>
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
                        {...field}
                        placeholder="0.00"
                        className="border-gray-300 dark:border-gray-700"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Amount of hydrogen credits to add
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreditDialog(false)}
                  disabled={crediting}
                  className="flex-1 border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={creditForm.handleSubmit(handleCredit)}
                  disabled={crediting}
                  className="flex-1 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  {crediting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {crediting ? "Processing..." : "Credit Tokens"}
                </Button>
              </div>
            </div>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick Actions Summary */}
      {walletInfo && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Wallet Status</CardDescription>
              <CardTitle className="flex items-center gap-2 text-lg">
                {isRegistered ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    Registered
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    Unregistered
                  </>
                )}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Current Balance</CardDescription>
              <CardTitle className="font-mono text-2xl">
                {walletInfo.balance} HC
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-2">
              <CardDescription>Network</CardDescription>
              <CardTitle className="text-lg">Ganache Local</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Wallet Address Display */}
      {walletInfo && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">Wallet Details</CardTitle>
            <CardDescription>
              Your deterministic wallet generated from PAN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Address
                  </p>
                  <p className="font-mono text-sm break-all">
                    {walletInfo.walletAddress}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard.writeText(walletInfo.walletAddress)
                  }
                  className="border-gray-300 dark:border-gray-700"
                >
                  Copy
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    PAN
                  </p>
                  <p className="font-mono text-sm">{walletInfo.pan}</p>
                </div>
                <Badge
                  variant="outline"
                  className="border-gray-300 dark:border-gray-700"
                >
                  Linked
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
