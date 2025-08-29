"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "~/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

interface CompanyInfo {
  company_name: string;
  address: string;
  sector: string;
  phone: string;
  owner_name: string;
  owner_email: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<CompanyInfo>({
    company_name: "",
    address: "",
    sector: "",
    phone: "",
    owner_name: "",
    owner_email: "",
  });

  useEffect(() => {
    if (!session?.user?.gst) return;

    const checkCompany = async () => {
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("gst", session.user.gst)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setIsNew(false);
        } else {
          setIsNew(true);
        }
      } catch (err: any) {
        console.error("Error fetching company info:", err.message || err);
        toast.error("Failed to check company info.");
      } finally {
        setLoading(false);
      }
    };

    checkCompany();
  }, [session?.user?.gst]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.gst || !session?.user?.pan) return;

    try {
      const { error } = await supabase.from("companies").upsert({
        gst: session.user.gst,
        pan: session.user.pan,
        email: session.user.email,
        ...form,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Company info saved successfully!");
      setIsNew(false);
    } catch (err: any) {
      console.error("Error saving company info:", err.message || err);
      toast.error("Failed to save company info.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Complete Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* PAN */}
              <div>
                <Label htmlFor="pan">PAN Number</Label>
                <Input
                  id="pan"
                  name="pan"
                  value={session?.user?.pan || ""}
                  readOnly
                  className="cursor-not-allowed bg-gray-100"
                />
              </div>

              {/* GST */}
              <div>
                <Label htmlFor="gst">GST Number</Label>
                <Input
                  id="gst"
                  name="gst"
                  value={session?.user?.gst || ""}
                  readOnly
                  className="cursor-not-allowed bg-gray-100"
                />
              </div>

              <div>
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  name="sector"
                  value={form.sector}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input
                  id="owner_name"
                  name="owner_name"
                  value={form.owner_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="owner_email">Owner Email</Label>
                <Input
                  id="owner_email"
                  name="owner_email"
                  type="email"
                  value={form.owner_email}
                  onChange={handleChange}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Save & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Welcome to your Dashboard</h1>
    </div>
  );
}
