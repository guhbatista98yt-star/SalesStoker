import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import type { Company } from "@shared/schema";

const STORAGE_KEY = "compras_selected_company";

export function useComprasCompany() {
  const [companyId, setCompanyIdState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? "all"; } catch { return "all"; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, companyId); } catch {}
  }, [companyId]);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/companies", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 300_000,
  });

  function setCompanyId(id: string) {
    setCompanyIdState(id);
  }

  return { companyId, setCompanyId, companies, companiesLoading };
}
