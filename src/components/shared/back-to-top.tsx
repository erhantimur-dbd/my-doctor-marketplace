"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 400);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full shadow-lg transition-all hover:shadow-xl"
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
