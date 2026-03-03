import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-background/80">
      <div className="text-center">
        <div className="mb-8">
          <span className="text-6xl">🧹</span>
          <h1 className="text-3xl font-bold mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
            Sweep
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to sweep your dust</p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-card border shadow-xl",
            },
          }}
        />
      </div>
    </div>
  );
}
