interface ClientPortalProps {
  // Client portal - simple training view only
  children: React.ReactNode;
}

export function ClientPortal({ children }: ClientPortalProps) {
  return <div className="mx-auto flex max-w-[900px] flex-col gap-8">{children}</div>;
}
