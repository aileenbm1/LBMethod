interface CoachPortalProps {
  // Coach portal - full featured dashboard
  children: React.ReactNode;
}

export function CoachPortal({ children }: CoachPortalProps) {
  return <div className="flex flex-col gap-8">{children}</div>;
}
