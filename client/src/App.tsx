import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface HelloResponse {
  message: string;
  time: string;
}

export default function App() {
  const [hello, setHello] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHello = () => {
    setError(null);
    fetch("/api/hello")
      .then((r) => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json() as Promise<HelloResponse>;
      })
      .then(setHello)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(fetchHello, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Drone Operations App</h1>
      {hello && (
        <p className="text-sm">
          Server says: <span className="font-mono">{hello.message}</span> ({hello.time})
        </p>
      )}
      {error && <p className="text-sm text-red-600">Could not reach server: {error}</p>}
      <Button onClick={fetchHello}>Ping server</Button>
    </main>
  );
}
