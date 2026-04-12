import { useState, useCallback, useEffect } from "react";

export interface DashboardCard {
  id: string;
  title: string;
}

const STORAGE_KEY = "dashboard-layout";

const DEFAULT_KPI_ORDER = ["vendas-semanal", "vendas-mensal", "afaturar-total"];
const DEFAULT_SIDEBAR_ORDER = ["afaturar-vendedores", "goals", "alerts"];
const DEFAULT_BOTTOM_ORDER = ["ranking", "product-mix"];
const DEFAULT_MAIN_ORDER = ["sales-chart"];

export interface DashboardLayout {
  kpiCards: string[];
  sidebarCards: string[];
  bottomCards: string[];
  mainCards: string[];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  kpiCards: DEFAULT_KPI_ORDER,
  sidebarCards: DEFAULT_SIDEBAR_ORDER,
  bottomCards: DEFAULT_BOTTOM_ORDER,
  mainCards: DEFAULT_MAIN_ORDER,
};

function loadLayout(): DashboardLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        kpiCards: parsed.kpiCards ?? DEFAULT_KPI_ORDER,
        sidebarCards: parsed.sidebarCards ?? DEFAULT_SIDEBAR_ORDER,
        bottomCards: parsed.bottomCards ?? DEFAULT_BOTTOM_ORDER,
        mainCards: parsed.mainCards ?? DEFAULT_MAIN_ORDER,
      };
    }
  } catch {
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: DashboardLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const updateKpiOrder = useCallback((newOrder: string[]) => {
    setLayout((prev) => ({ ...prev, kpiCards: newOrder }));
  }, []);

  const updateSidebarOrder = useCallback((newOrder: string[]) => {
    setLayout((prev) => ({ ...prev, sidebarCards: newOrder }));
  }, []);

  const updateBottomOrder = useCallback((newOrder: string[]) => {
    setLayout((prev) => ({ ...prev, bottomCards: newOrder }));
  }, []);

  const updateMainOrder = useCallback((newOrder: string[]) => {
    setLayout((prev) => ({ ...prev, mainCards: newOrder }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    updateKpiOrder,
    updateSidebarOrder,
    updateBottomOrder,
    updateMainOrder,
    resetLayout,
  };
}
