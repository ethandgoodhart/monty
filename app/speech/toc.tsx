"use client";

import { useEffect, useState } from "react";

export function Toc({ sections }: { sections: [string, string][] }) {
  const [active, setActive] = useState(sections[0][0]);

  useEffect(() => {
    const root = document.getElementById("yp-root");
    const onScroll = () => {
      let cur = sections[0][0];
      for (const [id] of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) cur = id;
      }
      setActive(cur);
    };
    root?.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root?.removeEventListener("scroll", onScroll);
  }, [sections]);

  return (
    <nav className="yp-toc" aria-label="On this page">
      {sections.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={active === id ? "is-on" : ""}>
          {label}
        </a>
      ))}
    </nav>
  );
}
