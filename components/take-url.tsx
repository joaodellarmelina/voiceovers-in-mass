"use client";

import { createContext, useContext } from "react";
import type { Take } from "@/lib/types";

type TakeUrl = (projectId: string, take: Take) => string;

const defaultTakeUrl: TakeUrl = (projectId, take) => `/api/projects/${projectId}/takes/${take.id}/audio`;

/**
 * Where a take's audio is served from. The app streams it from the local API; the landing page
 * renders the same review components over static files in /public.
 */
export const TakeUrlContext = createContext<TakeUrl>(defaultTakeUrl);

export const useTakeUrl = () => useContext(TakeUrlContext);
