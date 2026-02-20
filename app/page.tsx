"use client";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  function redirectToSubdomain(subdomain: string) {
    if (typeof window === "undefined") return;

    // Deconstruct url components
    const url =
      subdomain === "moa"
        ? (process.env.NEXT_PUBLIC_MOA_URL as string)
        : (process.env.NEXT_PUBLIC_UNI_URL as string);

    // Reconstruct and redirect
    const fullUrl = `${url}/login`;
    window.location.href = fullUrl;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">MOA Management Platform</h1>
        <p className="text-muted-foreground mx-auto max-w-md">
          Welcome! Please choose your role to proceed.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button size="lg" className="w-64" onClick={() => redirectToSubdomain("moa")}>
          I'm a Company
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-64"
          onClick={() => redirectToSubdomain("univ")}
        >
          I'm from the University
        </Button>
      </div>
    </main>
  );
}
