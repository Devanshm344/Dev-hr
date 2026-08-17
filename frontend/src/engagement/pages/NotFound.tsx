import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-engagement-display text-5xl font-semibold text-engagement-line">404</p>
      <p className="mt-3 font-medium">This page does not exist</p>
      <p className="mt-1 text-engagement-ink-faint">Check the address, or head back to your dashboard.</p>
      <Link to="/engagement">
        <Button variant="secondary" className="mt-5">Go to Home</Button>
      </Link>
    </div>
  );
}
