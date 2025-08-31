"use client";

import { useState, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { LogOutIcon, UserCircleIcon, DollarSign, Rocket } from "lucide-react";
import Image from "next/image";

// Base navigation for all users
const baseNavigation = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Contact Us", href: "/contact" },
];

// Additional links for authenticated users
const authenticatedNav = [
  { name: "Trade", href: "/dashboard/trade", icon: DollarSign },
  { name: "Produce", href: "/dashboard/produce", icon: Rocket },
];

export function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  const navigation = useMemo(() => {
    if (isAuthenticated) {
      return [...baseNavigation, ...authenticatedNav];
    }
    return baseNavigation;
  }, [isAuthenticated]);

  return (
    // --- THE FIX IS HERE: Changed 'absolute' to 'fixed' ---
    <header className="bg-background/80 sticky inset-x-0 top-0 z-50 border-b backdrop-blur-lg">
      <nav
        aria-label="Global"
        className="container mx-auto flex items-center justify-between p-2 lg:px-8" // Reduced padding for a tighter look
      >
        {/* Logo */}
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5">
            <span className="sr-only">Green Trade</span>
            <Image
              alt="Green Trade Logo"
              src="/logo.png"
              height={80} // Adjusted for new padding
              width={80} // Adjusted for new padding
              className="h-20 w-auto" // Adjusted for new padding
            />
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="text-foreground -m-2.5 inline-flex items-center justify-center rounded-md p-2.5"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex lg:gap-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-foreground hover:text-primary flex items-center gap-x-2 text-sm leading-6 font-semibold transition-colors"
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop User Actions */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-end lg:gap-x-4">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-x-2">
                <UserCircleIcon className="text-muted-foreground h-5 w-5" />
                <span className="text-foreground truncate text-sm font-medium">
                  {session.user?.email}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">
                Log In{" "}
                <span aria-hidden="true" className="ml-1">
                  &rarr;
                </span>
              </Link>
            </Button>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="lg:hidden"
      >
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="bg-background sm:ring-border fixed inset-y-0 right-0 z-50 w-full overflow-y-auto p-6 sm:max-w-sm sm:ring-1">
          <div className="flex items-center justify-between">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="sr-only">Green Trade</span>
              <Image
                alt="Green Trade Logo"
                src="/logo.png"
                height={80}
                width={80}
                className="h-16 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground -m-2.5 rounded-md p-2.5"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="divide-border -my-6 divide-y">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:bg-muted -mx-3 flex items-center gap-x-3 rounded-lg px-3 py-2 text-base leading-7 font-semibold"
                  >
                    {item.icon ? (
                      <item.icon className="text-muted-foreground h-5 w-5" />
                    ) : (
                      <div className="w-5" />
                    )}
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="py-6">
                {isAuthenticated ? (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="text-foreground hover:bg-muted -mx-3 flex w-full items-center gap-x-3 rounded-lg px-3 py-2.5 text-base leading-7 font-semibold"
                  >
                    <LogOutIcon className="text-muted-foreground h-5 w-5" />
                    Log Out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:bg-muted -mx-3 block rounded-lg px-3 py-2.5 text-base leading-7 font-semibold"
                  >
                    Log In
                  </Link>
                )}
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  );
}
