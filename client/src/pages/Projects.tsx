import { trpc } from "@/lib/trpc";
import { ProjectFollowThroughRead } from "@shared/ProjectFollowThroughRead";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function Projects() {
  useDocumentTitle("Project follow-through");
  const query = trpc.metrics.projectFollowThrough.useQuery(undefined, {
    staleTime: 15 * 60_000,
    retry: false,
  });
  return <ProjectFollowThroughRead data={query.data} loading={query.isLoading} />;
}
