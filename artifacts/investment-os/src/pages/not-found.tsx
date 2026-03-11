import { Layout } from "@/components/layout/Layout";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="h-[80vh] w-full flex flex-col items-center justify-center">
        <FileQuestion className="w-24 h-24 text-muted-foreground/30 mb-6" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">404 - Terminal Not Found</h1>
        <p className="text-muted-foreground">The module or component you requested does not exist in the system.</p>
      </div>
    </Layout>
  );
}
