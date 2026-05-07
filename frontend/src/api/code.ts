import api from './api'

export interface CodeResult {
  stdout: string | null
  stderr: string | null
  status: string
  exitCode: number
}

// Judge0 language IDs (common subset)
export const LANGUAGES: { label: string; id: number; ext: string }[] = [
  { label: 'Python', id: 71, ext: 'py' },
  { label: 'JavaScript', id: 63, ext: 'js' },
  { label: 'Java', id: 62, ext: 'java' },
  { label: 'C', id: 50, ext: 'c' },
  { label: 'C++', id: 54, ext: 'cpp' },
  { label: 'TypeScript', id: 74, ext: 'ts' },
  { label: 'Go', id: 60, ext: 'go' },
  { label: 'Rust', id: 73, ext: 'rs' },
]

export const codeApi = {
  execute: (sourceCode: string, languageId: number) =>
    api.post<CodeResult>('/api/code/execute', { sourceCode, languageId }).then((r) => r.data),
}
