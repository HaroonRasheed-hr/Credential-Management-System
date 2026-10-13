"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import ProjectDetailOverview from "@/components/projects/ProjectDetailOverview";
import type { Project } from "@/data/projects";

export default function ProjectDetailClient() {
  const pathname = usePathname();
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    // useParams() returns the static-export placeholder "_" in Next.js static exports
    // because the router context is anchored to the pre-generated shell.
    // window.location.pathname always reflects the real browser URL.
    const parts = window.location.pathname.replace(/\/$/, "").split("/");
    setProjectId(parts[parts.length - 1] ?? "");
  }, [pathname]);

  const { data, loading, error } = useProjectDetail(projectId);

  if (loading) {
    return (
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-16">
        <div className="mb-6 h-10 w-1/3 animate-pulse rounded-xl bg-white/5" />
        <div className="mb-8 flex gap-4 border-b border-white/10 pb-0">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="mb-0 h-8 w-24 animate-pulse rounded-t-xl bg-white/5"
            />
          ))}
        </div>
        <div className="h-48 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 mx-4 mt-8 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-4 sm:mx-8 md:mx-12 lg:mx-16">
        <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
        <p
          className="text-sm text-red-300"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          {error ?? "Project not found."}
        </p>
      </div>
    );
  }

  const project: Project = {
    id: data.id as unknown as number,
    name: data.name,
    description: data.description,
    longDescription: data.description,
    status: data.status === "ACTIVE" ? "Active" : "Archived",
    envVariables: data.env_count,
    licenseKeys: data.license_count,
    adminCredentials: data.admin_cred_count,
    teamMembers: data.member_count,
    createdDate: new Date(data.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    createdBy: data.created_by.username,
    createdById: data.created_by.id,
    password: data.password,
  };

  return <ProjectDetailOverview project={project} />;
}
