"use client";

import { useSession, signOut } from "next-auth/react";
import { UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar"; // <-- Import the sidebar hook

export function DashboardHeader() {
  const { data: session } = useSession();
  const { setOpen } = useSidebar(); // <-- Get the function to control the sidebar

  return (
    <header className="bg-background sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b px-4">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={() => setOpen(true)} // <-- This button now controls the sidebar
      >
        <UserCircle className="h-5 w-5" />
        <span className="sr-only">Toggle user menu</span>
      </Button>

      {/* This div pushes the user menu to the right */}
      <div className="flex-1" />

      {/* User Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <UserCircle className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{session?.user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
