"use client";

import { signOut } from "next-auth/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Ban, Clock } from "lucide-react";
import React from "react";

// Define the props for our new component
interface AccessBlockedPageProps {
  status: "pending" | "suspended";
}

// Content map to hold different text and icons for each status
const contentMap = {
  pending: {
    icon: Clock,
    iconBgColor: "bg-blue-100 dark:bg-blue-900/30",
    iconTextColor: "text-blue-500",
    title: "Verification Pending",
    description: "Your company's application is currently under review.",
    details:
      "Once an administrator has physically verified your production facility, your account will be activated. You will then gain access to the trading and production pages.",
  },
  suspended: {
    icon: Ban,
    iconBgColor: "bg-destructive/10",
    iconTextColor: "text-destructive",
    title: "Account Suspended",
    description:
      "Your company's access to the dashboard has been temporarily suspended.",
    details:
      "You will not be able to access the trading or production pages until your account status is updated. Please contact an administrator for more information.",
  },
};

export function AccessBlockedPage({ status }: AccessBlockedPageProps) {
  const content = contentMap[status];

  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${content.iconBgColor}`}
          >
            <content.icon className={`h-6 w-6 ${content.iconTextColor}`} />
          </div>
          <CardTitle className="mt-4">{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6 text-sm">
            {content.details}
          </p>
          <Button
            onClick={() => signOut({ callbackUrl: "/" })}
            variant="outline"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
