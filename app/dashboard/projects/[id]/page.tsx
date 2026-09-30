import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Workspace } from "@/components/workspace";
import { pageUser } from "@/lib/page-auth";
import { getProject, NotFoundError } from "@/lib/store";

// Shared by generateMetadata and the page within one request.
const load = cache(async (id: string) => {
  const { supabase, userId } = await pageUser(`/dashboard/projects/${id}`);
  try {
    return await getProject(supabase, userId, id);
  } catch (err) {
    // RLS hides other users' projects, so "not yours" and "doesn't exist" look the same: 404.
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: PageProps<"/dashboard/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await load(id)).name };
}

export default async function ProjectPage({ params }: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  const project = await load(id);
  // Keyed by id so navigating between projects resets client state.
  return <Workspace key={project.id} initial={project} />;
}
