import { supabase } from '../lib/supabase';
import type { LabelTemplate } from '../types/label';
import { cloneDefaultLabelTemplate } from '../utils/labelLayout';

const STORAGE_KEY = 'ejc-label-templates';
const MIGRATION_KEY = 'ejc-label-templates-migrated-to-db';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LabelTemplateRow = {
  id: string;
  name: string;
  template: Omit<LabelTemplate, 'id' | 'name' | 'createdAt' | 'updatedAt'>;
  created_at: string;
  updated_at: string;
};

function readLocalTemplates(): LabelTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as LabelTemplate[]) : [];
  } catch {
    return [];
  }
}

function toRowPayload(template: LabelTemplate) {
  const { id: _id, name: _name, createdAt: _createdAt, updatedAt: _updatedAt, ...templateData } = template;
  return templateData;
}

function getDatabaseId(id?: string) {
  return id && UUID_REGEX.test(id) ? id : crypto.randomUUID();
}

function fromRow(row: LabelTemplateRow): LabelTemplate {
  return {
    ...row.template,
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function migrateLocalTemplatesOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === 'true') return;

  const localTemplates = readLocalTemplates().filter((template) => template.id);
  if (localTemplates.length === 0) {
    localStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  const rows = localTemplates.map((template) => ({
    id: getDatabaseId(template.id),
    name: template.name || 'Novo Modelo',
    template: toRowPayload(template),
    created_at: template.createdAt || new Date().toISOString(),
    updated_at: template.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('label_templates')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw error;
  localStorage.setItem(MIGRATION_KEY, 'true');
}

export const labelTemplateService = {
  async listar(): Promise<LabelTemplate[]> {
    await migrateLocalTemplatesOnce();

    const { data, error } = await supabase
      .from('label_templates')
      .select('id, name, template, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) throw error;

    const templates = ((data || []) as LabelTemplateRow[]).map(fromRow);
    return templates.length > 0 ? templates : [cloneDefaultLabelTemplate()];
  },

  async salvar(template: LabelTemplate): Promise<LabelTemplate> {
    const id = getDatabaseId(template.id);
    const now = new Date().toISOString();
    const createdAt = template.createdAt || now;

    const { data, error } = await supabase
      .from('label_templates')
      .upsert({
        id,
        name: template.name || 'Novo Modelo',
        template: toRowPayload({ ...template, id, createdAt, updatedAt: now }),
        created_at: createdAt,
        updated_at: now,
      }, { onConflict: 'id' })
      .select('id, name, template, created_at, updated_at')
      .single();

    if (error) throw error;
    return fromRow(data as LabelTemplateRow);
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('label_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
