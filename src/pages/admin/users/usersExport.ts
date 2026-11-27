import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AdminUserListItem } from '../../../services/adminUserService';
import type { ExportConfig } from '../../../services/exportConfigService';
import {
    getContextGroupIds,
    getContextTeam,
    getUserSituation,
    USER_SITUATION_LABELS,
    type AccessContextId,
    type AdminGroup,
} from './usersAdminModel';

interface ExportInput {
    users: AdminUserListItem[];
    grupos: AdminGroup[];
    contextId: AccessContextId;
    contextLabel: string;
}

interface ExportRow {
    equipe: string;
    nome: string;
    email: string;
    perfis: string;
    situacao: string;
    primeiroAcessoPendente: boolean;
}

function buildRows({ users, grupos, contextId }: ExportInput): ExportRow[] {
    const groupNames = new Map(grupos.map(grupo => [grupo.id, grupo.nome]));
    return users
        .map(user => ({
            equipe: getContextTeam(user, contextId) || '— Sem equipe —',
            nome: user.nome || '[Conta sem pessoa vinculada]',
            email: user.email,
            perfis: getContextGroupIds(user, contextId).map(id => groupNames.get(id)).filter(Boolean).join('; '),
            situacao: USER_SITUATION_LABELS[getUserSituation(user, contextId)],
            primeiroAcessoPendente: user.temporary_password,
        }))
        .sort((a, b) => a.equipe.localeCompare(b.equipe, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

export function exportUsersCsv(input: ExportInput): void {
    const header = ['Nome', 'E-mail', `Equipe (${input.contextLabel})`, `Perfis (${input.contextLabel})`, 'Situação'];
    const lines = [header, ...buildRows(input).map(row => [row.nome, row.email, row.equipe, row.perfis, row.situacao])]
        .map(cells => cells.map(csvCell).join(','));

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usuarios_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportUsersPdf(input: ExportInput, config?: ExportConfig): void {
    const rows = buildRows(input);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const subtitle = `${input.contextLabel} • Gerado em ${new Date().toLocaleString('pt-BR')} • ${rows.length} usuário(s)`;
    let startY = 30;

    if (config) {
        if (config.imagem_esq_base64) {
            try { doc.addImage(config.imagem_esq_base64, 'PNG', 14, 10, 30, 30); } catch { /* imagem inválida: segue sem logo */ }
        }
        if (config.imagem_dir_base64) {
            try { doc.addImage(config.imagem_dir_base64, 'PNG', 166, 10, 30, 30); } catch { /* imagem inválida: segue sem logo */ }
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(config.titulo || '', 105, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(config.subtitulo || '', 105, 24, { align: 'center' });
        doc.text(config.tema || '', 105, 30, { align: 'center' });
        if (config.observacoes) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(config.observacoes, 105, 38, { align: 'center' });
        }
        startY = 60;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Usuários e acessos', 14, startY - 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(subtitle, 14, startY - 2);
        doc.setTextColor(0);
    } else {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Usuários e acessos', 14, 18);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(subtitle, 14, 24);
        doc.setTextColor(0);
    }

    autoTable(doc, {
        head: [['Equipe', 'Nome / E-mail', 'Perfis no encontro', 'Situação']],
        body: rows.map(row => [row.equipe, `${row.nome}\n${row.email}`, row.perfis || '—', row.situacao]),
        startY,
        styles: { fontSize: 8, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.25 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 38 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 45 },
            3: { cellWidth: 32 },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
    });

    doc.save(`usuarios_${Date.now()}.pdf`);
}
