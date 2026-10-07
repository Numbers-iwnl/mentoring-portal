"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "bd-scroll:";

/**
 * Restaura a posição de rolagem depois de qualquer envio de formulário (salvar, editar,
 * excluir — sucesso ou erro), em vez de deixar a navegação padrão voltar pro topo da página.
 * Um único listener global (montado no AppShell) cobre todas as páginas e formulários, sem
 * precisar de nenhum código específico por tela.
 */
export function ScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    const key = STORAGE_PREFIX + pathname;
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    sessionStorage.removeItem(key);
    const y = Number(saved);
    if (Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [pathname]);

  useEffect(() => {
    const handleSubmit = () => {
      sessionStorage.setItem(STORAGE_PREFIX + pathname, String(window.scrollY));
    };
    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, [pathname]);

  return null;
}
