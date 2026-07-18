import React from "react";

export const Table: React.FC<React.PropsWithChildren<React.TableHTMLAttributes<HTMLTableElement>>> = ({ className = "", children, ...props }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-surface-secondary/20">
    <table className={`w-full border-collapse text-sm text-left ${className}`} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLTableSectionElement>>> = ({ className = "", children, ...props }) => (
  <thead className={`border-b border-border-subtle bg-white/2 ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLTableSectionElement>>> = ({ className = "", children, ...props }) => (
  <tbody className={`divide-y divide-border-subtle ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLTableRowElement>>> = ({ className = "", children, ...props }) => (
  <tr className={`transition-colors hover:bg-white/1 ${className}`} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.PropsWithChildren<React.ThHTMLAttributes<HTMLTableCellElement>>> = ({ className = "", children, ...props }) => (
  <th className={`px-4 py-3 text-xs font-bold text-white/40 uppercase tracking-widest ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.PropsWithChildren<React.TdHTMLAttributes<HTMLTableCellElement>>> = ({ className = "", children, ...props }) => (
  <td className={`px-4 py-3 text-white/80 align-middle ${className}`} {...props}>
    {children}
  </td>
);
