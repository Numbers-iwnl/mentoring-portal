"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut size={16} />
      Sair
    </Button>
  );
}
