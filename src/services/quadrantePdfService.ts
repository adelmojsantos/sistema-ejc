import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type QuadranteData } from './quadranteService';

interface EncontroInfo {
    id: string;
    nome: string;
    tema?: string | null;
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
     * Generates the complete Yearbook PDF
     */
    async generateYearbook(encontro: EncontroInfo, data: QuadranteData[]) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // --- 1. COVER PAGE ---
        doc.setFillColor(15, 23, 42); // Deep Navy
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('QUADRANTE OFICIAL', pageWidth / 2, 80, { align: 'center' });

        doc.setFontSize(28);
        doc.text(encontro.nome.toUpperCase(), pageWidth / 2, 105, { align: 'center' });

        if (encontro.tema) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(16);
            doc.text(`"${encontro.tema}"`, pageWidth / 2, 120, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('EJC CAPELINHA', pageWidth / 2, pageHeight - 30, { align: 'center' });
        doc.text(new Date().getFullYear().toString(), pageWidth / 2, pageHeight - 24, { align: 'center' });

        // --- 2. ENCONTRISTAS (GRID) ---
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
            const cardHeight = cardWidth + 10; // Extra for name
            let currentX = margin;
            let currentY = 40;

            for (let i = 0; i < encontristas.length; i++) {
                const item = encontristas[i];

                // Page break check
                if (currentY + cardHeight > pageHeight - margin) {
                    doc.addPage();
                    currentY = 20;
                }

                // Placeholder / Photo
                doc.setFillColor(241, 245, 249);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(currentX, currentY, cardWidth, cardWidth, 2, 2, 'F');
                
                if (item.foto_url) {
                    const base64 = await this.getImageAsBase64(item.foto_url);
                    if (base64) {
                        try {
                            doc.addImage(base64, 'JPEG', currentX + 0.5, currentY + 0.5, cardWidth - 1, cardWidth - 1);
                        } catch (err) {
                            console.warn('Error adding image to PDF', err);
                        }
                    }
                }

                // Name
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                const name = item.pessoas.nome_completo;
                const splitName = doc.splitTextToSize(name, cardWidth - 2);
                doc.text(splitName, currentX + (cardWidth / 2), currentY + cardWidth + 4, { align: 'center' });

                // Move to next position
                if ((i + 1) % gridCols === 0) {
                    currentX = margin;
                    currentY += cardHeight + 10;
                } else {
                    currentX += cardWidth + 5;
                }
            }
        }

        // --- 3. TEAMS (VERTICAL LAYOUT) ---
        // Group by team
        const teams: Record<string, QuadranteData[]> = {};
        data.filter(d => !d.participante).forEach(item => {
            const t = item.equipes?.nome || 'Equipe Geral';
            if (!teams[t]) teams[t] = [];
            teams[t].push(item);
        });

        const sortedTeams = Object.entries(teams).sort(([a], [b]) => a.localeCompare(b));

        for (const [teamName, members] of sortedTeams) {
            doc.addPage();
            
            // Team Header
            doc.setFillColor(15, 23, 42);
            doc.rect(margin, 20, pageWidth - (margin * 2), 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(teamName.toUpperCase(), margin + 10, 45);

            // Team Photo (if exists)
            let listStartY = 70;
            const teamPhotoUrl = members[0]?.equipes?.foto_url;
            if (teamPhotoUrl) {
                const base64 = await this.getImageAsBase64(teamPhotoUrl);
                if (base64) {
                    try {
                        const imgHeight = 60;
                        doc.addImage(base64, 'JPEG', margin, 70, pageWidth - (margin * 2), imgHeight, undefined, 'FAST');
                        listStartY = 70 + imgHeight + 10;
                    } catch (err) {
                        console.warn('Error adding team photo', err);
                    }
                }
            }

            // Members Table
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

        // Global Footer (Page Numbers)
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${totalPages} • Gerado via Sistema EJC`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Quadrante_${encontro.nome.replace(/\s+/g, '_')}.pdf`);
    }
};
