import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from 'lucide-react';

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
          <p>
            <span className="text-sm mt-2 block">
              Vous serez redirigé vers la page de connexion dans quelques secondes...
            </span>
          </p>
          <Link href="/auth/login">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Aller à la connexion
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
