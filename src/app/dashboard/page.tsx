"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, AlertCircle, Building } from "lucide-react";
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
  company_name: z.string().min(2, "Company name is required"),
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(10, "A valid phone number is required"),
  sector: z.string().min(2, "Sector is required"),
  owner_name: z.string().min(2, "Owner's name is required"),
  owner_email: z.string().email("A valid owner email is required"),
  daily_usage: z.coerce.number().min(0, "Must be 0 or greater").default(0),
});

type CompanyForm = z.infer<typeof companySchema>;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    if (session?.user) {
      form.reset({
        company_name: "",
        address: "",
        phone: "",
        sector: "",
        owner_name: session.user.name || "",
        owner_email: session.user.email || "",
        daily_usage: 1,
      });
    }
  }, [session, form]);

  const fetchCompanyInfo = async () => {
    if (!session?.user?.pan) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select(`*`)
        .eq("pan", session.user.pan)
        .maybeSingle();
      if (error) throw error;
      setCompany(data);
    } catch (err: any) {
      console.error("Error fetching company info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchCompanyInfo();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, session]);

  const onSubmit = async (values: CompanyForm) => {
    if (!session?.user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .insert([
          {
            pan: session.user.pan,
            gst: session.user.gst,
            email: session.user.email,
            verified: false,
            ...values,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      setCompany(data);
    } catch (err: any) {
      console.error("Error inserting company info:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>
      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : company ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Welcome, {company.company_name}
            </CardTitle>
            <CardDescription>
              This is your company's main dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">
                Verification Status
              </p>
              {company.verified ? (
                <Badge>Verified</Badge>
              ) : (
                <Badge variant="destructive">Pending Verification</Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">PAN</p>
              <p className="font-mono text-sm">{company.pan}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">GST</p>
              <p className="font-mono text-sm">{company.gst}</p>
            </div>
            {/* Add more dashboard analytics cards here */}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Complete Your Profile
            </CardTitle>
            <CardDescription>
              Provide your company's details to get started. Your account will
              be pending verification after submission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
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
                        <FormLabel>Full Registered Address</FormLabel>
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
                        <FormLabel>Contact Phone</FormLabel>
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
                        <FormLabel>Business Sector</FormLabel>
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
                        <FormLabel>Owner's Full Name</FormLabel>
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
                        <FormLabel>Owner's Email</FormLabel>
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
                        <FormLabel>Estimated Daily Credit Usage</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
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
                  Submit for Verification
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
