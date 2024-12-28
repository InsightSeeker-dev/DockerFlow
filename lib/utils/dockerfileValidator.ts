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

  // Sécurité renforcée
  {
    pattern: /^RUN\s+.*curl\s+.*\|\s*sh/i,
    message: 'Évitez d\'exécuter des scripts téléchargés directement via curl',
    severity: 'error',
  },
  {
    pattern: /^RUN\s+.*wget\s+.*\|\s*sh/i,
    message: 'Évitez d\'exécuter des scripts téléchargés directement via wget',
    severity: 'error',
  },
  {
    pattern: /^RUN\s+.*chmod\s+777/i,
    message: 'Évitez d\'utiliser des permissions trop permissives (777)',
    severity: 'error',
  },
  {
    pattern: /^ENV\s+.*PASSWORD.*=/i,
    message: 'Évitez de stocker des mots de passe en tant que variables d\'environnement',
    severity: 'error',
  },
  {
    pattern: /^ENV\s+.*SECRET.*=/i,
    message: 'Évitez de stocker des secrets en tant que variables d\'environnement',
    severity: 'error',
  },

  // Optimisation de la taille
  {
    pattern: /^RUN\s+apt-get\s+install\s+.*[^&]\s*$/i,
    message: 'Combinez les commandes RUN pour réduire le nombre de couches',
    severity: 'warning',
    fix: (line: string) => `${line} && apt-get clean && rm -rf /var/lib/apt/lists/*`,
  },
  {
    pattern: /^RUN\s+npm\s+install\s+.*[^&]\s*$/i,
    message: 'Nettoyez le cache npm après l\'installation',
    severity: 'warning',
    fix: (line: string) => `${line} && npm cache clean --force`,
  },
  {
    pattern: /^RUN\s+pip\s+install\s+.*[^&]\s*$/i,
    message: 'Utilisez --no-cache-dir avec pip install',
    severity: 'warning',
    fix: (line: string) => line.replace('pip install', 'pip install --no-cache-dir'),
  },

  // Multi-stage builds
  {
    pattern: /^FROM\s+\S+\s+AS\s+\S+/i,
    message: 'Bonne utilisation du multi-stage build',
    severity: 'warning',
  },
  {
    pattern: /^COPY\s+--from=\S+\s+/i,
    message: 'Bonne utilisation de COPY --from dans un multi-stage build',
    severity: 'warning',
  },

  // Bonnes pratiques
  {
    pattern: /^WORKDIR\s+\/app/i,
    message: 'Bonne pratique : utilisation de /app comme répertoire de travail',
    severity: 'warning',
  },
  {
    pattern: /^EXPOSE\s+\d+/i,
    message: 'Bonne pratique : exposition explicite des ports',
    severity: 'warning',
  },
  {
    pattern: /^HEALTHCHECK/i,
    message: 'Bonne pratique : définition d\'un healthcheck',
    severity: 'warning',
  }
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
  score: number;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let score = 100;

  // Vérifications de sécurité
  if (content.includes('USER root')) {
    score -= 20;
    recommendations.push('Évitez d\'utiliser l\'utilisateur root comme utilisateur final');
  }

  if (!content.includes('USER')) {
    score -= 15;
    recommendations.push('Définissez un utilisateur non-root explicite');
  }

  if (content.match(/chmod\s+777/)) {
    score -= 25;
    recommendations.push('Les permissions 777 sont dangereuses, utilisez des permissions plus restrictives');
  }

  if (content.match(/ENV\s+.*PASSWORD/i) || content.match(/ENV\s+.*SECRET/i)) {
    score -= 30;
    recommendations.push('Ne stockez jamais de secrets ou mots de passe dans les variables d\'environnement');
  }

  if (content.match(/curl\s+.*\|\s*sh/) || content.match(/wget\s+.*\|\s*sh/)) {
    score -= 40;
    recommendations.push('L\'exécution de scripts téléchargés présente un risque de sécurité majeur');
  }

  // Vérifications des bonnes pratiques de sécurité
  if (!content.includes('HEALTHCHECK')) {
    score -= 5;
    recommendations.push('Ajoutez un HEALTHCHECK pour surveiller l\'état du conteneur');
  }

  if (content.includes(':latest')) {
    score -= 10;
    recommendations.push('Utilisez des versions spécifiques des images plutôt que latest');
  }

  // Limiter le score entre 0 et 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    recommendations: Array.from(new Set(recommendations)), // Dédupliquer les recommandations
  };
}
