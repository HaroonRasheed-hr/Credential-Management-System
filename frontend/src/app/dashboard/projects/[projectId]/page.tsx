import ProjectDetailClient from "./ProjectDetailClient";

export function generateStaticParams() {
  // Returns a placeholder shell for the static export.
  // Django serves this shell for any real project ID;
  // the client-side router then renders the correct project.
  return [{ projectId: "_" }];
}

export default function ProjectDetailPage() {
  return <ProjectDetailClient />;
}
