import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type QuadranteData } from './quadranteService';
import { type Palestra } from '../types/palestra';

interface EncontroInfo {
    id: string;
    nome: string;
    tema?: string | null;
    logo_url?: string | null;
    simbologia_texto?: string | null;
    tematica_texto?: string | null;
    musica_letra?: string | null;
}

/**
 * Service to generate a professional PDF Yearbook (Quadrante)
 */
export const quadrantePdfService = {
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

    /**
     * Generates the complete Yearbook PDF (7 Sections)
     */
    async generateYearbook(encontro: EncontroInfo, data: QuadranteData[], palestras: Palestra[] = []) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // --- 1. COVER PAGE ---
        doc.setFillColor(15, 23, 42); // Deep Navy
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Logo on Cover
        if (encontro.logo_url) {
            const logoBase64 = await this.getImageAsBase64(encontro.logo_url);
            if (logoBase64) {
                try {
                    const logoSize = 60;
                    doc.addImage(logoBase64, 'PNG', (pageWidth - logoSize) / 2, 40, logoSize, logoSize);
                } catch (e) { console.warn('Logo error', e); }
            }
        }

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('QUADRANTE OFICIAL', pageWidth / 2, 115, { align: 'center' });

        doc.setFontSize(32);
        const splitNome = doc.splitTextToSize(encontro.nome.toUpperCase(), pageWidth - 40);
        doc.text(splitNome, pageWidth / 2, 135, { align: 'center' });

        if (encontro.tema) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(18);
            doc.text(`"${encontro.tema}"`, pageWidth / 2, 160, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('EJC CAPELINHA', pageWidth / 2, pageHeight - 30, { align: 'center' });
        doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight - 24, { align: 'center' });

        // --- 2. SIMBOLOGIA ---
        doc.addPage();
        this.renderSectionHeader(doc, 'Simbologia');
        
        // Simbologia Logo
        const simbologiaLogo = 'https://portaldafamilia.com.br/wp-content/uploads/2018/11/logo_ejc.png';
        const sLogoBase64 = await this.getImageAsBase64(simbologiaLogo);
        if (sLogoBase64) {
            doc.addImage(sLogoBase64, 'PNG', (pageWidth - 40) / 2, 45, 40, 40);
        }

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const sText = encontro.simbologia_texto || 'O Jovem no mundo...';
        const splitSText = doc.splitTextToSize(sText, pageWidth - (margin * 2));
        doc.text(splitSText, margin, 100, { align: 'justify' });

        // --- 3. TEMÁTICA ---
        doc.addPage();
        this.renderSectionHeader(doc, encontro.tema || 'Temática');
        
        if (encontro.logo_url) {
            const tLogoBase64 = await this.getImageAsBase64(encontro.logo_url);
            if (tLogoBase64) {
                doc.addImage(tLogoBase64, 'PNG', (pageWidth - 40) / 2, 45, 40, 40);
            }
        }

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        const tText = encontro.tematica_texto || 'Referências do tema...';
        const splitTText = doc.splitTextToSize(tText, pageWidth - (margin * 2));
        doc.text(splitTText, margin, 100, { align: 'justify' });

        // --- 4. MÚSICA TEMA ---
        doc.addPage();
        this.renderSectionHeader(doc, 'Música Tema');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(encontro.tema || 'Letra da Música', pageWidth / 2, 55, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const mText = encontro.musica_letra || 'Letra não disponível';
        const splitMText = doc.splitTextToSize(mText, pageWidth - (margin * 4));
        doc.text(splitMText, pageWidth / 2, 70, { align: 'center' });

        // --- 5. ENCONTRISTAS (GRID) ---
        const encontristas = data.filter(d => d.participante);
        if (encontristas.length > 0) {
            doc.addPage();
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text('Encontristas', margin, 25);
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(1);
            doc.line(margin, 28, margin + 40, 28);

            const gridCols = 4;
            const cardWidth = (pageWidth - (margin * 2) - ((gridCols - 1) * 5)) / gridCols;
            const cardHeight = cardWidth + 10;
            let currentX = margin;
            let currentY = 40;

            for (let i = 0; i < encontristas.length; i++) {
                const item = encontristas[i];
                if (currentY + cardHeight > pageHeight - margin) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFillColor(241, 245, 249);
                doc.roundedRect(currentX, currentY, cardWidth, cardWidth, 2, 2, 'F');
                
                if (item.foto_url) {
                    const base64 = await this.getImageAsBase64(item.foto_url);
                    if (base64) {
                        try {
                            doc.addImage(base64, 'JPEG', currentX + 0.5, currentY + 0.5, cardWidth - 1, cardWidth - 1);
                        } catch (err) { console.warn('Photo error', err); }
                    }
                }

                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(15, 23, 42);
                const name = item.pessoas.nome_completo;
                const splitName = doc.splitTextToSize(name, cardWidth - 2);
                doc.text(splitName, currentX + (cardWidth / 2), currentY + cardWidth + 4, { align: 'center' });

                if ((i + 1) % gridCols === 0) {
                    currentX = margin;
                    currentY += cardHeight + 10;
                } else {
                    currentX += cardWidth + 5;
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

        for (const [teamName, members] of sortedTeams) {
            doc.addPage();
            doc.setFillColor(15, 23, 42);
            doc.rect(margin, 20, pageWidth - (margin * 2), 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text(teamName.toUpperCase(), margin + 10, 45);

            let listStartY = 70;
            const teamPhotoUrl = members[0]?.equipes?.foto_url;
            if (teamPhotoUrl) {
                const base64 = await this.getImageAsBase64(teamPhotoUrl);
                if (base64) {
                    try {
                        const imgHeight = 60;
                        doc.addImage(base64, 'JPEG', margin, 70, pageWidth - (margin * 2), imgHeight, undefined, 'FAST');
                        listStartY = 70 + imgHeight + 10;
                    } catch (err) { console.warn('Team photo error', err); }
                }
            }

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.text('Composição da Equipe:', margin, listStartY);

            const tableRows = members
                .sort((a, b) => a.pessoas.nome_completo.localeCompare(b.pessoas.nome_completo))
                .map((m, idx) => [(idx + 1).toString().padStart(2, '0'), m.pessoas.nome_completo]);

            autoTable(doc, {
                head: [['#', 'Nome Completo']],
                body: tableRows,
                startY: listStartY + 5,
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [15, 23, 42] },
                margin: { left: margin, right: margin }
            });
        }

        // --- 7. PALESTRAS ---
        if (palestras && palestras.length > 0) {
            doc.addPage();
            this.renderSectionHeader(doc, 'Palestras');
            
            let pY = 50;
            for (const p of palestras) {
                if (pY + 50 > pageHeight - margin) {
                    doc.addPage();
                    pY = 30;
                }

                // Speaker Photo
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(margin, pY, 30, 30, 2, 2, 'F');
                if (p.palestrante_foto_url) {
                    const pBase64 = await this.getImageAsBase64(p.palestrante_foto_url);
                    if (pBase64) {
                        try {
                            doc.addImage(pBase64, 'JPEG', margin + 0.5, pY + 0.5, 29, 29);
                        } catch (e) { console.warn('Speaker photo error', e); }
                    }
                }

                // Lecture Text
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(p.titulo, margin + 35, pY + 5);
                
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(p.palestrante_nome || '', margin + 35, pY + 11);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
                doc.setFontSize(9);
                const pResumo = p.resumo || '';
                const splitPResumo = doc.splitTextToSize(pResumo, pageWidth - margin - 35 - margin);
                doc.text(splitPResumo, margin + 35, pY + 18, { align: 'justify' });

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
