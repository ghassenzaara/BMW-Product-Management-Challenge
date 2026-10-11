"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { ArgonMark } from "@/components/brand/marks";
import type { Role } from "@/contracts";
import { useApi } from "@/lib/api/hooks";
import { setUserId } from "@/lib/session";
import { Avatar } from "@/components/common/people";
import { Pill } from "@/components/common/badges";

const roleText: Record<Role, { label: string; does: string }> = {
  vehicle_pm: { label: "Vehicle PM", does: "Owns cases and requirements for one series and region." },
  attribute_pm: { label: "Attribute / option PM", does: "Owns one attribute across series (Baukasten); receives referrals." },
  head: { label: "Head of product line", does: "Portfolio, sign-off of the top N, escalations, brand profile and default weights." },
};

const story: Record<string, string> = {
  "u-lena": "Start here: refer the buttons case, paste a meeting note, re-rank with weights.",
  "u-wei": "China view: escalate the equipment conflict, react to the CLTC alert.",
  "u-jonas": "Accept referrals from the 1 and 5 Series into one Baukasten case.",
  "u-katrin": "Sign off requirements, resolve the China vs Europe escalations.",
};

export function LoginView() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: users = [] } = useApi("users");
  const main = users.filter((u) => story[u.id]);
  const others = users.filter((u) => !story[u.id]);

  const go = (id: string) => {
    setUserId(id);
    qc.clear();
    router.push("/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 sm:p-10">
      <div className="w-full max-w-4xl space-y-10">
        <div className="space-y-5 text-center">
          <ArgonMark className="mx-auto block size-12" />
          <h1 className="text-[40px] leading-[1.12] font-semibold sm:text-heading-lg lg:text-display">Argon</h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-body-lg">
            Derive, justify and prioritize customer requirements for the next vehicle generation. Signals become cases, cases become requirements, and every step stays traceable.
          </p>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">Demo login · pick a persona. People, web signals and decisions are synthetic; BMW feedback, study and sales rows are real.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {main.map((u) => (
            <button key={u.id} onClick={() => go(u.id)} className="group flex gap-3.5 rounded-xl border bg-card p-5 text-left outline-none transition-colors duration-150 hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/40">
              <Avatar user={u} size="md" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.name}</span>
                  <Pill t={u.role === "head" ? "emerald" : u.role === "attribute_pm" ? "violet" : "sky"}>{roleText[u.role].label}</Pill>
                </span>
                <span className="block text-[13px] text-muted-foreground">{u.title}</span>
                <span className="block text-sm leading-normal">{story[u.id]}</span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition duration-150 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" strokeWidth={1.75} />
            </button>
          ))}
        </div>
        {others.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            Also:
            {others.map((u) => (
              <button key={u.id} onClick={() => go(u.id)} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-foreground outline-none transition-colors duration-150 hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/40">
                <Avatar user={u} size="xs" /> {u.name} <span className="text-xs text-muted-foreground">({u.title.split("·")[0].replace("Product Manager", "PM").trim()})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
