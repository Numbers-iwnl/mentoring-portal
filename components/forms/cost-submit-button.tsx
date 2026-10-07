"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CostSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full md:w-auto">
      {pending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
      {pending ? "Salvando..." : "Salvar custo/hora"}
    </Button>
  );
}
