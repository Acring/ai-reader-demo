import { Button } from '@/components/ui/button';

interface ToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
  onFileSelect: (file: File) => void;
  onExport: () => void;
  hasContent: boolean;
}

const colors = ['#ff0000', '#00cc00', '#0066ff', '#ff9900', '#9933ff', '#000000'];

export function Toolbar({
  color,
  onColorChange,
  onFileSelect,
  onExport,
  hasContent,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <Button render={<label />} className="cursor-pointer">
          打开 PDF
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
            hidden
          />
        </Button>
        {hasContent && (
          <Button variant="secondary" onClick={onExport}>
            导出 Markdown
          </Button>
        )}
      </div>

      {hasContent && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-section">
            <span className="toolbar-hint">选中文字可添加高亮或批注</span>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-section color-section">
            <span className="color-label">颜色</span>
            {colors.map((c) => (
              <button
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => onColorChange(c)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
