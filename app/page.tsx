import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="container mx-auto px-4 py-16">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Eviction Management
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Run a legally compliant eviction without guessing.
        </h1>
        <p className="text-lg text-muted-foreground">
          Jurisdiction-aware workflow, court-ready documents, and an attorney
          marketplace when you need one. Built for small landlords. Currently
          available in Fulton County, Georgia.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg"><Link href="/login">Get started</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="#how">How it works</Link></Button>
        </div>
      </section>

      <section id="how" className="mx-auto mt-24 grid max-w-5xl gap-8 sm:grid-cols-3">
        {[
          { title: "1. Open a case", body: "Tell us the lease, tenant, and grounds. We confirm the jurisdiction." },
          { title: "2. Serve the notice", body: "We generate the right notice for your county and track the cure window." },
          { title: "3. File or close", body: "If the tenant cures, we close. If not, we draft the complaint and file." },
        ].map((s) => (
          <div key={s.title} className="space-y-2 rounded-lg border bg-card p-6">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 border-t pt-8 text-center text-xs text-muted-foreground">
        <p>This service provides workflow and document automation. It is not a law firm and does not provide legal advice.</p>
      </footer>
    </main>
  );
}
