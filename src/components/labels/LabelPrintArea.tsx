import { forwardRef } from 'react';
import type { LabelDataItem, LabelTemplate } from '../../types/label';
import { getOrientedSheetDimensions } from '../../utils/labelLayout';
import { LabelCanvas } from './LabelCanvas';

interface LabelPrintAreaProps {
  template: LabelTemplate;
  pages: LabelDataItem[][];
  className?: string;
}

export const LabelPrintArea = forwardRef<HTMLDivElement, LabelPrintAreaProps>(function LabelPrintArea(
  { template, pages, className = '' },
  ref,
) {
  const sheet = getOrientedSheetDimensions(template.printSettings);
  return (
    <div ref={ref} className={`label-print-area ${className}`}>
      {pages.map((page, pageIndex) => (
        <section
          className="label-print-page"
          key={`page-${pageIndex}`}
          style={{
            width: `${sheet.width}mm`,
            height: `${sheet.height}mm`,
            padding: `${template.printSettings.marginTop}mm ${template.printSettings.marginRight}mm ${template.printSettings.marginBottom}mm ${template.printSettings.marginLeft}mm`,
          }}
        >
          <div
            className="label-print-grid"
            style={{
              gridTemplateColumns: `repeat(${template.printSettings.columns}, ${template.width}mm)`,
              gridAutoRows: `${template.height}mm`,
              columnGap: `${template.printSettings.horizontalGap}mm`,
              rowGap: `${template.printSettings.verticalGap}mm`,
            }}
          >
            {page.map((item, itemIndex) => <LabelCanvas key={`${item.id}-${pageIndex}-${itemIndex}`} template={template} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
});
