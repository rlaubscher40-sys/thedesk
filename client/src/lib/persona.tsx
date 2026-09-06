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
  return (PERSONAS as readonly string[]).includes(raw as string) ? (raw as Persona) : PERSONAS[0]!;
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(readStored);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, persona);
  }, [persona]);

  const setPersona = (p: Persona) => setPersonaState(p);

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>{children}</PersonaContext.Provider>
  );
}

export function usePersona(): Ctx {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside PersonaProvider");
  return ctx;
}

/** Reader position → distinguishing accent. Matches the brand palette. */
export const PERSONA_COLOUR: Record<Persona, string> = {
  Buying: "oklch(0.78 0.18 70)", // amber
  Holding: "oklch(0.72 0.17 155)", // green
  Watching: "oklch(0.62 0.18 25)", // ink / rust
};

/**
 * Display spelling for a reader position.
 *
 * The canonical keys stay single bare words ("Buying") because they are line
 * prefixes in stored text and get built into a regex, but a bare gerund reads
 * as a label rather than as something about the reader. Spelling it as a clause
 * is what makes the block land as "this is you".
 *
 * Keyed loosely so it also tidies LLM-generated talkingPoints keys, and falls
 * through unchanged for anything it does not recognise — including the old
 * partner roles on rows written before the change, which should read as
 * whatever they were rather than being silently relabelled.
 */
export function personaDisplayLabel(label: string): string {
  const n = label.toLowerCase().replace(/[^a-z]/g, "");
  if (n === "buying" || n === "buyer" || n === "buyers") return "If you're buying";
  if (n === "holding" || n === "holder" || n === "holders") return "If you're holding";
  if (n === "watching" || n === "watcher" || n === "watchers") return "If you're watching";
  return label;
}
