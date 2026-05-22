import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type QuadranteData } from './quadranteService';
import { type Palestra } from '../types/palestra';
import { quadranteVisibilityDefault, type QuadranteVisibilityConfig } from '../types/encontro';

interface EncontroInfo {
    id: string;
    nome: string;
    tema?: string | null;
    musica?: string | null;
    logo_url?: string | null;
    simbologia_texto?: string | null;
    tematica_texto?: string | null;
    musica_letra?: string | null;
    quadrante_visibilidade?: QuadranteVisibilityConfig | null;
}

/**
 * Service to generate a professional PDF Yearbook (Quadrante)
 */
export const quadrantePdfService = {
    colors: {
        navy: [15, 23, 42] as [number, number, number],
        blue: [37, 99, 235] as [number, number, number],
        slate: [71, 85, 105] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number],
        line: [226, 232, 240] as [number, number, number],
        soft: [248, 250, 252] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
    },

    /**
     * Converts a URL to a Base64 string for jsPDF
     */
    async getImageAsBase64(url: string): Promise<string | null> {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error('Error fetching image for PDF:', e);
            return null;
        }
    },

    async loadImage(url: string): Promise<HTMLImageElement | null> {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            return await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(img);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(null);
                };
                img.src = objectUrl;
            });
        } catch (e) {
            console.error('Error loading image for PDF:', e);
            return null;
        }
    },

    async prepareImage(
        url: string,
        options: { width: number; height: number; fit?: 'cover' | 'contain'; background?: string; mimeType?: 'image/jpeg' | 'image/png' }
    ): Promise<string | null> {
        const img = await this.loadImage(url);
        if (!img) return null;

        const canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = Math.round(options.width * scale);
        canvas.height = Math.round(options.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (options.background) {
            ctx.fillStyle = options.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        const targetRatio = canvas.width / canvas.height;
        const sourceRatio = sourceWidth / sourceHeight;

        if (options.fit === 'contain') {
            const drawScale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
            const drawWidth = sourceWidth * drawScale;
            const drawHeight = sourceHeight * drawScale;
            ctx.drawImage(img, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
        } else {
            let sx = 0;
            let sy = 0;
            let sw = sourceWidth;
            let sh = sourceHeight;

            if (sourceRatio > targetRatio) {
                sw = sourceHeight * targetRatio;
                sx = (sourceWidth - sw) / 2;
            } else {
                sh = sourceWidth / targetRatio;
                sy = (sourceHeight - sh) / 2;
            }

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        }

        return canvas.toDataURL(options.mimeType || 'image/jpeg', 0.9);
    },

    async addPreparedImage(
        doc: jsPDF,
        url: string,
        x: number,
        y: number,
        width: number,
        height: number,
        options: { fit?: 'cover' | 'contain'; background?: string; radius?: number; fallbackLabel?: string } = {}
    ): Promise<boolean> {
        const image = await this.prepareImage(url, {
            width,
            height,
            fit: options.fit || 'cover',
            background: options.background,
            mimeType: options.fit === 'contain' ? 'image/png' : 'image/jpeg'
        });

        if (!image) return false;

        try {
            if (options.radius) {
                doc.setFillColor(...this.colors.white);
                doc.roundedRect(x, y, width, height, options.radius, options.radius, 'F');
            }
            doc.addImage(image, options.fit === 'contain' ? 'PNG' : 'JPEG', x, y, width, height, undefined, 'FAST');
            return true;
        } catch (e) {
            console.warn(`Image add error${options.fallbackLabel ? ` (${options.fallbackLabel})` : ''}`, e);
            return false;
        }
    },

    htmlToText(html?: string | null): string {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<li>/gi, '- ')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    renderTextPanel(
        doc: jsPDF,
        text: string,
        options: { x: number; y: number; width: number; maxHeight?: number; fontSize?: number; lineHeight?: number }
    ): number {
        const fontSize = options.fontSize || 9.5;
        const lineHeight = options.lineHeight || (fontSize * 0.45);
        const padding = 6;
        const usableWidth = options.width - (padding * 2);
        const lines = doc.splitTextToSize(text, usableWidth);
        const maxLines = options.maxHeight ? Math.floor((options.maxHeight - (padding * 2)) / lineHeight) : lines.length;
        const visibleLines = lines.slice(0, maxLines);
        const panelHeight = (visibleLines.length * lineHeight) + (padding * 2);

        doc.setFillColor(...this.colors.soft);
        doc.setDrawColor(...this.colors.line);
        doc.roundedRect(options.x, options.y, options.width, panelHeight, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(...this.colors.slate);
        doc.text(visibleLines, options.x + padding, options.y + padding + 3, {
            align: 'left',
            lineHeightFactor: lineHeight / (fontSize * 0.3528)
        });

        return options.y + panelHeight;
    },

    /**
     * Generates the complete Yearbook PDF (7 Sections)
     */
    async generateYearbook(encontro: EncontroInfo, data: QuadranteData[], palestras: Palestra[] = []) {
        const visibility = {
            ...quadranteVisibilityDefault,
            ...(encontro.quadrante_visibilidade || {})
        };
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // --- 1. COVER PAGE ---
        doc.setFillColor(...this.colors.navy);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageWidth, 7, 'F');

        // Logo on Cover
        if (encontro.logo_url) {
            const logoSize = 58;
            await this.addPreparedImage(doc, encontro.logo_url, (pageWidth - logoSize) / 2, 38, logoSize, logoSize, {
                fit: 'contain',
                background: '#0f172a',
                radius: 8,
                fallbackLabel: 'cover logo'
            });
        }

        doc.setTextColor(...this.colors.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('QUADRANTE OFICIAL', pageWidth / 2, 112, { align: 'center' });

        doc.setFontSize(32);
        const splitNome = doc.splitTextToSize(encontro.nome.toUpperCase(), pageWidth - 40);
        doc.text(splitNome, pageWidth / 2, 132, { align: 'center' });

        if (encontro.tema) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(18);
            doc.text(`"${encontro.tema}"`, pageWidth / 2, 158, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('EJC CAPELINHA', pageWidth / 2, pageHeight - 30, { align: 'center' });
        doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight - 24, { align: 'center' });

        // --- 2. SIMBOLOGIA ---
        if (visibility.simbologia) {
            doc.addPage();
            this.renderSectionHeader(doc, 'Simbologia');
            
            const logoSize = 60;
            const logoY = 35;
            const logoX = (pageWidth - logoSize) / 2;
            const textY = logoY + logoSize + 8; // 103mm

            // Simbologia Logo
            const simbologiaLogo = `${window.location.origin}/logo-ejc.jpg`;
            await this.addPreparedImage(doc, simbologiaLogo, logoX, logoY, logoSize, logoSize, {
                fit: 'contain',
                background: '#ffffff',
                radius: 6,
                fallbackLabel: 'simbologia logo'
            });

            const sText = this.htmlToText(encontro.simbologia_texto) || 'O Jovem no mundo...';
            this.renderTextPanel(doc, sText, {
                x: margin,
                y: textY,
                width: contentWidth,
                maxHeight: pageHeight - textY - margin,
                fontSize: 9.2,
                lineHeight: 4.7
            });
        }

        // --- 3. TEMÁTICA ---
        if (visibility.tematica) {
            doc.addPage();
            this.renderSectionHeader(doc, encontro.tema || 'Temática');
            
            const logoSize = 60;
            const logoY = 35;
            let textY = logoY + logoSize + 8; // 103mm

            if (encontro.logo_url) {
                const logoX = (pageWidth - logoSize) / 2;
                await this.addPreparedImage(doc, encontro.logo_url, logoX, logoY, logoSize, logoSize, {
                    fit: 'contain',
                    background: '#ffffff',
                    radius: 6,
                    fallbackLabel: 'tema logo'
                });
            } else {
                textY = 35;
            }

            const tText = this.htmlToText(encontro.tematica_texto) || 'Referências do tema...';
            this.renderTextPanel(doc, tText, {
                x: margin,
                y: textY,
                width: contentWidth,
                maxHeight: pageHeight - textY - margin,
                fontSize: 9.5,
                lineHeight: 4.8
            });
        }

        // --- 4. MÚSICA TEMA ---
        if (visibility.musica) {
            doc.addPage();
            this.renderSectionHeader(doc, 'Música Tema');
            
            doc.setTextColor(...this.colors.navy);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(encontro.musica || 'Letra da Música', pageWidth / 2, 55, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...this.colors.slate);
            const mText = this.htmlToText(encontro.musica_letra) || 'Letra não disponível';
            const splitMText = doc.splitTextToSize(mText, pageWidth - (margin * 4));
            doc.text(splitMText, pageWidth / 2, 70, { align: 'center' });
        }

        // --- 5. ENCONTRISTAS (GRID) ---
        const encontristas = data.filter(d => d.participante);
        if (visibility.encontristas && encontristas.length > 0) {
            doc.addPage();
            this.renderSubCover(doc, 'Encontristas');

            doc.addPage();
            this.renderSectionHeader(doc, 'Encontristas');

            const gridCols = 3;
            const gap = 7;
            const cardWidth = (contentWidth - ((gridCols - 1) * gap)) / gridCols;
            const imageHeight = 38;
            const cardHeight = 56;
            let currentX = margin;
            let currentY = 40;

            for (let i = 0; i < encontristas.length; i++) {
                const item = encontristas[i];
                if (currentY + cardHeight > pageHeight - margin) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFillColor(...this.colors.white);
                doc.setDrawColor(...this.colors.line);
                doc.roundedRect(currentX, currentY, cardWidth, cardHeight, 3, 3, 'FD');
                doc.setFillColor(...this.colors.soft);
                doc.roundedRect(currentX + 2, currentY + 2, cardWidth - 4, imageHeight, 2, 2, 'F');
                
                if (item.foto_url) {
                    await this.addPreparedImage(doc, item.foto_url, currentX + 2, currentY + 2, cardWidth - 4, imageHeight, {
                        fit: 'cover',
                        fallbackLabel: item.pessoas?.nome_completo
                    });
                }

                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...this.colors.navy);
                const name = item.pessoas.nome_completo;
                const splitName = doc.splitTextToSize(name, cardWidth - 2);
                doc.text(splitName.slice(0, 2), currentX + (cardWidth / 2), currentY + imageHeight + 8, { align: 'center' });

                if ((i + 1) % gridCols === 0) {
                    currentX = margin;
                    currentY += cardHeight + gap;
                } else {
                    currentX += cardWidth + gap;
                }
            }
        }

        // --- 6. EQUIPES ---
        const teams: Record<string, QuadranteData[]> = {};
        data.filter(d => !d.participante).forEach(item => {
            const t = item.equipes?.nome || 'Equipe Geral';
            if (!teams[t]) teams[t] = [];
            teams[t].push(item);
        });

        const sortedTeams = Object.entries(teams).sort(([a], [b]) => a.localeCompare(b));

        if (visibility.encontreiros && sortedTeams.length > 0) {
            doc.addPage();
            this.renderSubCover(doc, 'Equipes de Trabalho');

            for (const [teamName, members] of sortedTeams) {
                doc.addPage();
                doc.setFillColor(...this.colors.navy);
                doc.roundedRect(margin, 20, contentWidth, 36, 3, 3, 'F');
                doc.setTextColor(...this.colors.white);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text(teamName.toUpperCase(), margin + 10, 43);

                let listStartY = 66;
                const teamPhotoUrl = members[0]?.equipes?.foto_url;
                if (teamPhotoUrl) {
                    const imgHeight = 58;
                    const added = await this.addPreparedImage(doc, teamPhotoUrl, margin, 66, contentWidth, imgHeight, {
                        fit: 'cover',
                        fallbackLabel: teamName
                    });
                    if (added) {
                        listStartY = 66 + imgHeight + 10;
                    }
                }

                doc.setTextColor(...this.colors.navy);
                doc.setFontSize(12);
                doc.text('Composição da Equipe:', margin, listStartY);

                const tableRows = members
                    .sort((a, b) => a.pessoas.nome_completo.localeCompare(b.pessoas.nome_completo))
                    .map((m, idx) => [(idx + 1).toString().padStart(2, '0'), m.pessoas.nome_completo]);

                autoTable(doc, {
                    head: [['#', 'Nome Completo']],
                    body: tableRows,
                    startY: listStartY + 5,
                    styles: { fontSize: 9, cellPadding: 2.3, lineColor: this.colors.line },
                    alternateRowStyles: { fillColor: this.colors.soft },
                    headStyles: { fillColor: this.colors.navy },
                    margin: { left: margin, right: margin }
                });
            }
        }

        // --- 7. PALESTRAS ---
        if (visibility.palestras && palestras && palestras.length > 0) {
            doc.addPage();
            this.renderSectionHeader(doc, 'Palestras');
            
            let pY = 50;
            for (const p of palestras) {
                if (pY + 50 > pageHeight - margin) {
                    doc.addPage();
                    pY = 30;
                }

                // Speaker Photo
                doc.setFillColor(...this.colors.soft);
                doc.roundedRect(margin, pY, 30, 30, 3, 3, 'F');
                if (p.palestrante_foto_url) {
                    await this.addPreparedImage(doc, p.palestrante_foto_url, margin + 0.5, pY + 0.5, 29, 29, {
                        fit: 'cover',
                        fallbackLabel: p.palestrante_nome || p.titulo
                    });
                }

                // Lecture Text
                doc.setTextColor(...this.colors.navy);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(p.titulo, margin + 35, pY + 5);
                
                doc.setFontSize(9);
                doc.setTextColor(...this.colors.muted);
                doc.text(p.palestrante_nome || '', margin + 35, pY + 11);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...this.colors.slate);
                doc.setFontSize(9);
                const pResumo = this.htmlToText(p.resumo) || '';
                const splitPResumo = doc.splitTextToSize(pResumo, pageWidth - margin - 35 - margin);
                doc.text(splitPResumo.slice(0, 6), margin + 35, pY + 18, { align: 'left' });

                pY += 45;
            }
        }

        // Global Footer (Page Numbers)
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${totalPages} • Gerado via Sistema EJC`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Quadrante_${encontro.nome.replace(/\s+/g, '_')}.pdf`);
    },

    /**
     * Helper to render a section sub-cover page
     */
    renderSubCover(doc: jsPDF, title: string) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Sub-cover has a light background
        doc.setFillColor(...this.colors.white);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Centralized section title
        doc.setTextColor(...this.colors.navy);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(28);
        doc.text(title.toUpperCase(), pageWidth / 2, (pageHeight / 2) - 10, { align: 'center' });

        // Centered accent divider line below the title
        doc.setFillColor(...this.colors.blue);
        const lineWidth = 30;
        const lineHeight = 1.5;
        doc.rect((pageWidth - lineWidth) / 2, (pageHeight / 2) + 2, lineWidth, lineHeight, 'F');
    },

    /**
     * Helper to render a consistent section header
     */
    renderSectionHeader(doc: jsPDF, title: string) {
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(title, 20, 25);
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(1);
        doc.line(20, 28, 60, 28);
    }
};
