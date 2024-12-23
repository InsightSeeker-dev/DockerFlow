import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Account Created Successfully!</CardTitle>
          <CardDescription>
            Thank you for registering with DockerFlow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">Next Steps:</h3>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Check your email for a verification link</li>
              <li>Click the link to verify your account</li>
              <li>Once verified, you can log in to your account</li>
            </ol>
          </div>
          
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">Important Information:</h3>
            <ul className="list-disc pl-4 space-y-2">
              <li>The verification link expires in 24 hours</li>
              <li>Check your spam folder if you don&apos;t see the email</li>
              <li>Contact support if you need assistance</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-3 mt-6">
            <Link href="/auth" className="w-full">
              <Button className="w-full" variant="default">
                Go to Login
              </Button>
            </Link>
            <Link href="/support" className="w-full">
              <Button className="w-full" variant="outline">
                Contact Support
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
