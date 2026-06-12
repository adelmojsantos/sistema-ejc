import type { LabelTemplate } from '../types/label';
import { cloneDefaultLabelTemplate } from '../utils/labelLayout';

const STORAGE_KEY = 'ejc-label-templates';

// Adapter temporário: mantém a mesma API assíncrona esperada de um futuro service Supabase.
function readTemplates(): LabelTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as LabelTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: LabelTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export const labelTemplateService = {
  async listar(): Promise<LabelTemplate[]> {
    const templates = readTemplates();
    return templates.length > 0 ? templates : [cloneDefaultLabelTemplate()];
  },

  async salvar(template: LabelTemplate): Promise<LabelTemplate> {
    const templates = readTemplates();
    const saved = {
      ...template,
      id: template.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    const index = templates.findIndex((item) => item.id === saved.id);
    if (index >= 0) templates[index] = saved;
    else templates.push(saved);
    writeTemplates(templates);
    return saved;
  },

  async excluir(id: string): Promise<void> {
    writeTemplates(readTemplates().filter((template) => template.id !== id));
  },
};
