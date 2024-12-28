import Link from "next/link";
import { Mail } from "lucide-react";

export default function VerifyRequest() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Mail className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-center">Check your email</h1>
          <p className="text-muted-foreground text-center">
            A verification link has been sent to your email address. Please click
            the link to verify your account.
          </p>
          <div className="w-full p-4 bg-muted/50 rounded text-sm text-muted-foreground">
            <p className="font-medium">Tip:</p>
            <p>If you don&apos;t see the email in your inbox, please check your spam folder.</p>
          </div>
          <Link
            href="/auth"
            className="text-primary hover:text-primary/80 flex items-center space-x-2"
          >
            <span>← Return to login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
