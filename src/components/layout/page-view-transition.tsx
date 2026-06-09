import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export default function PageViewTransition({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div key={pathname} className="page-view-transition">
      {children}
    </div>
  );
}
