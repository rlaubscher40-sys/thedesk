/**
 * Active partner persona, drives the "VIEW AS" switch and every card's
 * highlighted angle / Say This line. Persisted to localStorage so the
 * choice survives a reload.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PERSONAS, type Persona } from "@/data/editions/2026-05-15";

const STORAGE_KEY = "thedesk:active-persona";

type Ctx = {
  persona: Persona;
  setPersona: (p: Persona) => void;
};

const PersonaContext = createContext<Ctx | null>(null);

function readStored(): Persona {
  if (typeof window === "undefined") return PERSONAS[0]!;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return (PERSONAS as readonly string[]).includes(raw as string)
    ? (raw as Persona)
    : PERSONAS[0]!;
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(readStored);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, persona);
  }, [persona]);

  const setPersona = (p: Persona) => setPersonaState(p);

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): Ctx {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside PersonaProvider");
  return ctx;
}

/** Persona → distinguishing accent. Matches the brand palette. */
export const PERSONA_COLOUR: Record<Persona, string> = {
  Institutional: "oklch(0.72 0.16 250)", // institutional blue
  Broker: "oklch(0.78 0.18 70)", // amber
  Adviser: "oklch(0.72 0.17 155)", // adviser green
  "Buyers Agent": "oklch(0.62 0.18 25)", // ink / rust
};

/**
 * Display spelling for a persona label. The stored/canonical key stays
 * "Buyers Agent" (no apostrophe) so parsing and matching never break on old
 * data, but the reader sees the grammatically correct "Buyer's Agent". Keyed
 * loosely so it also tidies LLM-generated talkingPoints keys.
 */
export function personaDisplayLabel(label: string): string {
  const n = label.toLowerCase().replace(/[^a-z]/g, "");
  if (n.startsWith("buyer")) return "Buyer's Agent";
  return label;
}
