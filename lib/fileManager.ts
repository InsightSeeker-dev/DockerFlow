export interface FileEntry {
  id: string;
  name: string;
  content: string;
  type: 'dockerfile' | 'file';
  lastModified: Date;
}

export interface ProjectFiles {
  dockerfile: FileEntry | null;
  additionalFiles: FileEntry[];
}

export interface FileImportResult {
  success: boolean;
  file?: FileEntry;
  error?: string;
}

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export function generateFileId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export async function importFile(file: File): Promise<FileImportResult> {
  try {
    const content = await readFileContent(file);
    const fileEntry: FileEntry = {
      id: generateFileId(),
      name: file.name,
      content: content,
      type: file.name.toLowerCase() === 'dockerfile' ? 'dockerfile' : 'file',
      lastModified: new Date(file.lastModified)
    };
    return { success: true, file: fileEntry };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to import file' 
    };
  }
}

export function validateDockerfile(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic Dockerfile validation
  if (!content.trim()) {
    errors.push('Dockerfile cannot be empty');
    return { isValid: false, errors };
  }

  const lines = content.split('\n');
  let hasFrom = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('FROM ')) {
      hasFrom = true;
      break;
    }
  }

  if (!hasFrom) {
    errors.push('Dockerfile must contain a FROM instruction');
  }

  return { isValid: errors.length === 0, errors };
}
