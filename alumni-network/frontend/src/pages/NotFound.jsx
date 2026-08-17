import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">This page doesn't exist.</p>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    </div>;
}
