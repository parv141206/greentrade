"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

const DUMMY_VALID_USERS = [
  { pan: "ABCDE1234F", gst: "22AAAAA0000A1Z5", email: "parv141206@gmail.com" },
  { pan: "FGHIJ5678K", gst: "33BBBBB0000B2Z6", email: "test@example.com" },
  { pan: "KLMNO9012P", gst: "11CCCCC0000C3Z7", email: "another@example.com" },
];

export default function LoginPage() {
  const [pan, setPan] = useState("");
  const [gst, setGst] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"pan_gst" | "otp">("pan_gst");
  const [loading, setLoading] = useState(false);
  const [otpEmailInfo, setOtpEmailInfo] = useState<string | null>(null);

  const router = useRouter();

  const handlePanGstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const user = DUMMY_VALID_USERS.find((u) => u.pan === pan && u.gst === gst);
    const emailToDisplay = user ? user.email : "your registered email";

    try {
      const result = await signIn("credentials", {
        redirect: false,
        pan,
        gst,
      });

      if (
        result?.error === "Configuration" &&
        result.ok === true &&
        result.status === 200
      ) {
        setStep("otp");
        setOtpEmailInfo(emailToDisplay);
        toast.success(
          `An OTP has been sent to ${emailToDisplay}. Please enter it below.`,
        );
      } else if (result?.error === "CredentialsSignin") {
        toast.error(
          "Invalid PAN or GST number. Please check your credentials.",
        );
      } else if (result?.error) {
        toast.error(result.error);
      } else {
        toast.error(
          "An unexpected authentication issue occurred. Please try again.",
        );
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected client-side error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        pan,
        gst,
        otp,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          toast.error(
            "Invalid or expired OTP. Please try again or request a new one.",
          );
        } else {
          toast.error(result.error);
        }
      } else if (result?.ok) {
        toast.success("Login successful!");
        router.push("/dashboard");
      } else {
        toast.error("An unknown error occurred during OTP verification.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Login</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "pan_gst" && (
            <form onSubmit={handlePanGstSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pan">PAN Number</Label>
                <Input
                  id="pan"
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  required
                  disabled={loading}
                  placeholder="ABCDE1234F"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gst">GST Number</Label>
                <Input
                  id="gst"
                  type="text"
                  value={gst}
                  onChange={(e) => setGst(e.target.value.toUpperCase())}
                  required
                  disabled={loading}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="******"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("pan_gst");
                    setOtp("");
                    setOtpEmailInfo(null);
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Back / Request New OTP
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Verifying..." : "Verify & Log In"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
