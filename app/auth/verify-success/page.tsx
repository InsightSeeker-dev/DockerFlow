import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VerifySuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Email vérifié avec succès !</CardTitle>
          <CardDescription>
            Votre compte a été activé. Vous pouvez maintenant vous connecter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/auth">
            <Button>Se connecter</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
