import { ProjectsProvider } from "@/context/ProjectsContext";
import { ActivityProvider } from "@/context/ActivityContext";
import { SearchProvider } from "@/context/SearchContext";
import AuthGuard from "@/components/common/AuthGuard";
import Toaster from "@/components/common/Toaster";
import DashboardHeader from "@/components/common/DashboardHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ActivityProvider>
        <ProjectsProvider>
          <SearchProvider>
            <div
              className="min-h-screen w-full text-white"
              style={{
                background: "linear-gradient(180deg, #212121 0%, #000000 100%)",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              <DashboardHeader />
              <main className="mx-auto w-full max-w-[1440px]">
                {children}
              </main>
            </div>
            <Toaster />
          </SearchProvider>
        </ProjectsProvider>
      </ActivityProvider>
    </AuthGuard>
  );
}
