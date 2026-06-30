import React from 'react';

export type PortalTabType = "rutina"|"registrar"|"chat"|"historial"|"rutinas";

interface TabConfig {
  id: PortalTabType;
  label: string;
}

export const PORTAL_TABS: TabConfig[] = [
  {id:"rutina", label:"Mi entrenamiento"},
  {id:"rutinas", label:"Historial de rutinas"},
  {id:"chat", label:"Chat coach"},
  {id:"historial", label:"Historial"},
];

interface PortalTabsProps {
  activeTab: PortalTabType;
  onTabChange: (tab: PortalTabType) => void;
  isCoach: boolean;
}

export function PortalTabBar({ activeTab, onTabChange, isCoach }: PortalTabsProps) {
  const visibleTabs = isCoach ? PORTAL_TABS : PORTAL_TABS.filter(t => t.id !== "rutinas");

  return (
    <div className="flex gap-2 border-b-2 border-[#e7e1d6]">
      {visibleTabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`px-4 py-3 text-[13px] font-semibold transition border-b-2 -mb-[2px] ${
            activeTab === t.id
              ? "border-[#a87d49] text-[#a87d49]"
              : "border-transparent text-[#8c8377] hover:text-[#17120d]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
