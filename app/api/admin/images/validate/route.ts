import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  validateDockerfile,
  suggestImprovements,
  analyzeDockerfileSecurity,
} from '@/lib/utils/dockerfileValidator';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dockerfile } = await request.json();
    if (!dockerfile) {
      return NextResponse.json(
        { error: 'Dockerfile content is required' },
        { status: 400 }
      );
    }

    // Valider le Dockerfile
    const validationIssues = validateDockerfile(dockerfile);
    const suggestions = suggestImprovements(dockerfile);
    const securityAnalysis = analyzeDockerfileSecurity(dockerfile);

    // Déterminer si le Dockerfile est valide pour la construction
    const hasErrors = validationIssues.some(
      (issue) => issue.severity === 'error'
    );

    return NextResponse.json({
      valid: !hasErrors,
      issues: validationIssues,
      suggestions,
      security: securityAnalysis,
    });
  } catch (error) {
    console.error('Error validating Dockerfile:', error);
    return NextResponse.json(
      { error: 'Failed to validate Dockerfile' },
      { status: 500 }
    );
  }
}
