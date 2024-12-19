interface ValidationRule {
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning';
  fix?: (line: string) => string;
}

interface ValidationIssue {
  line: number;
  message: string;
  severity: 'error' | 'warning';
  fix?: string;
}

const validationRules: ValidationRule[] = [
  // Règles de syntaxe de base
  {
    pattern: /^FROM\s+\S+/i,
    message: 'Le Dockerfile doit commencer par une instruction FROM',
    severity: 'error',
  },
  {
    pattern: /^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\s/i,
    message: 'Instruction Docker invalide',
    severity: 'error',
  },

  // Bonnes pratiques
  {
    pattern: /^RUN\s+apt-get\s+(?!update)/i,
    message: 'Il est recommandé de faire un apt-get update avant d\'installer des paquets',
    severity: 'warning',
    fix: (line: string) => line.replace(/^RUN\s+apt-get/, 'RUN apt-get update && apt-get'),
  },
  {
    pattern: /^RUN\s+apt-get\s+.*(?<!--no-install-recommends)/i,
    message: 'Utilisez --no-install-recommends avec apt-get install pour réduire la taille de l\'image',
    severity: 'warning',
    fix: (line: string) => {
      if (line.includes('install')) {
        return line.replace('install', 'install --no-install-recommends');
      }
      return line;
    },
  },
  {
    pattern: /^RUN\s+(?!.*&&).*apt-get\s+update/i,
    message: 'Combinez apt-get update et install dans la même instruction RUN',
    severity: 'warning',
  },
  {
    pattern: /^ADD\s+/i,
    message: 'Préférez COPY à ADD sauf si vous avez besoin de fonctionnalités spécifiques d\'ADD',
    severity: 'warning',
    fix: (line: string) => line.replace(/^ADD/, 'COPY'),
  },

  // Sécurité
  {
    pattern: /^RUN\s+.*curl\s+.*\|\s*sh/i,
    message: 'Évitez d\'exécuter des scripts téléchargés directement via curl',
    severity: 'error',
  },
  {
    pattern: /^USER\s+root\s*$/i,
    message: 'Évitez d\'utiliser l\'utilisateur root comme utilisateur final',
    severity: 'warning',
  },

  // Multi-stage builds
  {
    pattern: /^FROM\s+\S+\s+AS\s+\S+/i,
    message: 'Bonne utilisation du multi-stage build',
    severity: 'warning',
  },

  // Versions spécifiques
  {
    pattern: /^FROM\s+\S+:latest/i,
    message: 'Évitez d\'utiliser le tag latest, préférez une version spécifique',
    severity: 'warning',
    fix: (line: string) => line.replace(':latest', ':stable'),
  },

  // Cache des dépendances
  {
    pattern: /^COPY\s+package\*.json\s+\./i,
    message: 'Bonne pratique : copie des fichiers package.json avant les autres fichiers',
    severity: 'warning',
  },

  // Nettoyage
  {
    pattern: /^RUN\s+.*apt-get\s+.*(?<!&&\s*apt-get\s+clean)/i,
    message: 'Nettoyez le cache apt après l\'installation',
    severity: 'warning',
    fix: (line: string) => `${line} && apt-get clean && rm -rf /var/lib/apt/lists/*`,
  },
];

export function validateDockerfile(content: string): ValidationIssue[] {
  const lines = content.split('\n');
  const issues: ValidationIssue[] = [];
  let hasFrom = false;

  // Vérifier si le fichier est vide
  if (content.trim() === '') {
    issues.push({
      line: 0,
      message: 'Le Dockerfile ne peut pas être vide',
      severity: 'error',
    });
    return issues;
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Ignorer les commentaires et les lignes vides
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      return;
    }

    // Vérifier l'instruction FROM
    if (trimmedLine.startsWith('FROM')) {
      hasFrom = true;
    }

    // Appliquer toutes les règles de validation
    validationRules.forEach(rule => {
      if (!rule.pattern.test(trimmedLine)) {
        const isInvalidInstruction = !trimmedLine.match(/^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\s/i);
        
        if (rule.message === 'Instruction Docker invalide' && isInvalidInstruction) {
          issues.push({
            line: index + 1,
            message: rule.message,
            severity: rule.severity,
            fix: rule.fix?.(trimmedLine),
          });
        }
      } else if (rule.message.includes('warning')) {
        issues.push({
          line: index + 1,
          message: rule.message,
          severity: rule.severity,
          fix: rule.fix?.(trimmedLine),
        });
      }
    });

    // Vérifications supplémentaires
    if (trimmedLine.includes('&&') && trimmedLine.split('&&').some(cmd => cmd.trim() === '')) {
      issues.push({
        line: index + 1,
        message: 'Commande vide détectée dans une chaîne de commandes',
        severity: 'error',
      });
    }
  });

  // Vérifier si l'instruction FROM est présente
  if (!hasFrom) {
    issues.push({
      line: 1,
      message: 'Le Dockerfile doit commencer par une instruction FROM',
      severity: 'error',
    });
  }

  return issues;
}

export function suggestImprovements(content: string): string[] {
  const suggestions: string[] = [];
  const lines = content.split('\n');

  // Vérifier la présence de multi-stage builds
  if (!content.includes('FROM') || !content.includes('AS')) {
    suggestions.push(
      'Considérez l\'utilisation de multi-stage builds pour réduire la taille de l\'image finale'
    );
  }

  // Vérifier la présence d'un HEALTHCHECK
  if (!content.includes('HEALTHCHECK')) {
    suggestions.push(
      'Ajoutez un HEALTHCHECK pour permettre à Docker de surveiller l\'état de votre conteneur'
    );
  }

  // Vérifier la présence d'un utilisateur non-root
  if (!content.includes('USER') || content.includes('USER root')) {
    suggestions.push(
      'Considérez l\'utilisation d\'un utilisateur non-root pour améliorer la sécurité'
    );
  }

  // Vérifier l'utilisation de versions spécifiques
  if (content.includes(':latest')) {
    suggestions.push(
      'Utilisez des versions spécifiques des images plutôt que le tag "latest"'
    );
  }

  // Vérifier la présence de .dockerignore
  suggestions.push(
    'Assurez-vous d\'avoir un fichier .dockerignore approprié pour optimiser le contexte de build'
  );

  // Vérifier la présence de labels
  if (!content.includes('LABEL')) {
    suggestions.push(
      'Ajoutez des labels pour fournir des métadonnées à votre image (maintainer, version, etc.)'
    );
  }

  return suggestions;
}

export function fixDockerfile(content: string, issues: ValidationIssue[]): string {
  const lines = content.split('\n');
  const fixedLines = [...lines];

  issues.forEach(issue => {
    if (issue.fix) {
      fixedLines[issue.line - 1] = issue.fix;
    }
  });

  return fixedLines.join('\n');
}

export function analyzeDockerfileSecurity(content: string): {
  issues: ValidationIssue[];
  score: number;
  recommendations: string[];
} {
  const issues: ValidationIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const securityChecks = [
    {
      pattern: /^USER\s+root\s*$/im,
      message: 'Utilisation de l\'utilisateur root',
      severity: 'warning' as const,
      impact: -20,
      recommendation: 'Créez et utilisez un utilisateur non-root',
    },
    {
      pattern: /curl\s+.*\|\s*(?:bash|sh)/im,
      message: 'Exécution de scripts distants via curl',
      severity: 'error' as const,
      impact: -30,
      recommendation: 'Téléchargez et vérifiez les scripts avant de les exécuter',
    },
    {
      pattern: /chmod\s+777/im,
      message: 'Permissions trop permissives',
      severity: 'warning' as const,
      impact: -15,
      recommendation: 'Utilisez des permissions plus restrictives',
    },
    {
      pattern: /(api|access|secret).*key/im,
      message: 'Possible exposition de clés sensibles',
      severity: 'error' as const,
      impact: -25,
      recommendation: 'Utilisez des secrets Docker ou des variables d\'environnement',
    },
  ];

  securityChecks.forEach(check => {
    if (check.pattern.test(content)) {
      issues.push({
        line: content.split('\n').findIndex(line => check.pattern.test(line)) + 1,
        message: check.message,
        severity: check.severity,
      });
      score += check.impact;
      recommendations.push(check.recommendation);
    }
  });

  // Vérifications supplémentaires
  if (!content.includes('USER')) {
    score -= 10;
    recommendations.push('Spécifiez explicitement un utilisateur non-root');
  }

  if (!content.includes('HEALTHCHECK')) {
    score -= 5;
    recommendations.push('Ajoutez un HEALTHCHECK pour la surveillance du conteneur');
  }

  return {
    issues,
    score: Math.max(0, Math.min(100, score)),
    recommendations: [...new Set(recommendations)],
  };
}
