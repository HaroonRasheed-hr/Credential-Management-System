import TeamDetailClient from "./TeamDetailClient";

export function generateStaticParams() {
  // Returns a placeholder shell for the static export.
  // Django serves this shell for any real team ID;
  // the client-side router then renders the correct team.
  return [{ id: "_" }];
}

export default function TeamDetailPage() {
  return <TeamDetailClient />;
}
