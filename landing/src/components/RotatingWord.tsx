"use client";

import { useEffect, useState } from "react";

const WORDS = ["subscription", "marketplace", "storefront", "membership", "SaaS plan"];

export function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span key={i} className="inline-block animate-in fade-in slide-in-from-bottom-2 text-sky-600 duration-500">
      {WORDS[i]}
    </span>
  );
}
