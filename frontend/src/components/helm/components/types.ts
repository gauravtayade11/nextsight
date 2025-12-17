// Types for Helm workspace components

export interface TemplateFile {
  name: string;
  type: 'file' | 'folder';
  children?: TemplateFile[];
}

export interface AIInsight {
  type: 'warning' | 'suggestion' | 'info';
  message: string;
  fix?: string;
}
