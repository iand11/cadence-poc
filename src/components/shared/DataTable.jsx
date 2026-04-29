import { cn } from '../../utils/cn';

export default function DataTable({ columns, data, maxRows, onRowClick }) {
  const rows = maxRows ? data.slice(0, maxRows) : data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#3D3B37]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-xs font-medium text-[#9B9590]',
                  col.align === 'right' ? 'text-right' : 'text-left'
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-b border-[#2C2B28] transition-colors',
                rowIndex % 2 === 0 && 'bg-[#100F0E]',
                onRowClick ? 'hover:bg-[#1C1B18] cursor-pointer' : 'hover:bg-[#1C1B18]'
              )}
            >
              {columns.map((col) => {
                const rawValue = row[col.key];
                const isNumber = typeof rawValue === 'number';
                const displayValue = col.format ? col.format(rawValue, row) : rawValue;
                return (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 whitespace-nowrap',
                      isNumber ? 'font-mono text-sm text-[#F5F0E8]' : 'text-sm text-[#F5F0E8]',
                      col.align === 'right' || (isNumber && !col.align) ? 'text-right' : 'text-left'
                    )}
                  >
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
