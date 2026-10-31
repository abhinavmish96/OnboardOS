"use client";

import { useEffect, useState } from "react";

const WORDS = ["businesses", "merchants", "sellers", "partners", "customers"];

export function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span key={i} className="inline-block animate-in fade-in slide-in-from-bottom-2 text-ink underline decoration-cream decoration-4 underline-offset-8 duration-500">
      {WORDS[i]}
    </span>
  );
}
