"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "~/lib/supabase";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

const companySchema = z.object({
  company_name: z.string().min(2, "Required"),
  address: z.string().min(5, "Required"),
  phone: z.string().min(10, "Required"),
  sector: z.string().min(2, "Required"),
  owner_name: z.string().min(2, "Required"),
  owner_email: z.string().email("Invalid email"),
  daily_usage: z.coerce.number().min(1, "Must be at least 1 credit"),
});

type CompanyForm = z.infer<typeof companySchema>;

export default function HydrogenDataPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: "",
      address: "",
      phone: "",
      sector: "",
      owner_name: session?.user?.name || "",
      owner_email: session?.user?.email || "",
      daily_usage: 1,
    },
  });

  // Fetch company info
  const fetchCompanyInfo = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select(
          `id, pan, gst, email, company_name, address, phone, sector, owner_name, owner_email, created_at, daily_usage, verified`,
        )
        .eq("pan", session.user.pan)
        .eq("gst", session.user.gst)
        .maybeSingle();

      if (error) throw error;

      if (data) setCompany(data);
    } catch (err: any) {
      console.error("Error fetching company info:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchCompanyInfo();
  }, [status]);

  // Handle first-time sign-in form submit
  const onSubmit = async (values: CompanyForm) => {
    if (!session) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .insert([
          {
            pan: session.user.pan,
            gst: session.user.gst,
            email: session.user.email,
            company_name: values.company_name,
            address: values.address,
            phone: values.phone,
            sector: values.sector,
            owner_name: values.owner_name,
            owner_email: values.owner_email,
            daily_usage: values.daily_usage,
            verified: false,
          },
        ])
        .select();

      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("No data returned after insert");

      setCompany(data[0]);
    } catch (err: any) {
      console.error("Error inserting company info:", err?.message || err);
    } finally {
      setSubmitting(false);
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
        <p className="text-center text-lg">Please log in to continue.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      {company ? (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Company Information
            </CardTitle>
            <CardDescription>Details registered for trading</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="font-medium">Company Name:</p>
              <p>{company.company_name}</p>
            </div>
            <div>
              <p className="font-medium">PAN:</p>
              <p>{company.pan}</p>
            </div>
            <div>
              <p className="font-medium">GST:</p>
              <p>{company.gst}</p>
            </div>
            <div>
              <p className="font-medium">Email:</p>
              <p>{company.email}</p>
            </div>
            <div>
              <p className="font-medium">Phone:</p>
              <p>{company.phone}</p>
            </div>
            <div>
              <p className="font-medium">Address:</p>
              <p>{company.address}</p>
            </div>
            <div>
              <p className="font-medium">Sector:</p>
              <p>{company.sector}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium">Verified:</p>
              {company.verified ? (
                <Badge variant="success">Yes</Badge>
              ) : (
                <Badge variant="destructive">No</Badge>
              )}
            </div>
            <div>
              <p className="font-medium">Daily Usage:</p>
              <p>{company.daily_usage} credits</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              First-time Sign-in
            </CardTitle>
            <CardDescription>
              Complete your company profile to start trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Email</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="daily_usage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Credit Usage</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                className="mt-4 bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                onClick={form.handleSubmit(onSubmit)}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Complete Profile"}
              </Button>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
