import { useState } from "react";
import { 
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { ScoreItem } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";

interface CompanyTableProps {
  data: ScoreItem[];
  isLoading: boolean;
}

export function CompanyTable({ data, isLoading }: CompanyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const columns = [
    {
      accessorKey: "ticker",
      header: "Ticker",
      cell: ({ row }: any) => <span className="font-mono font-bold text-primary">{row.getValue("ticker")}</span>,
    },
    {
      accessorKey: "name",
      header: "Company",
      cell: ({ row }: any) => <span className="font-medium truncate max-w-[200px] block">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "sector",
      header: "Sector",
      cell: ({ row }: any) => <span className="text-xs text-muted-foreground">{row.getValue("sector")}</span>,
    },
    {
      accessorKey: "fortressScore",
      header: ({ column }: any) => {
        return (
          <button className="flex items-center gap-1 hover:text-emerald-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Fortress <ArrowUpDown className="w-3 h-3" />
          </button>
        )
      },
      cell: ({ row }: any) => <ScoreBadge score={row.getValue("fortressScore")} type="fortress" />,
    },
    {
      accessorKey: "rocketScore",
      header: ({ column }: any) => {
        return (
          <button className="flex items-center gap-1 hover:text-orange-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Rocket <ArrowUpDown className="w-3 h-3" />
          </button>
        )
      },
      cell: ({ row }: any) => <ScoreBadge score={row.getValue("rocketScore")} type="rocket" />,
    },
    {
      accessorKey: "waveScore",
      header: ({ column }: any) => {
        return (
          <button className="flex items-center gap-1 hover:text-cyan-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Wave <ArrowUpDown className="w-3 h-3" />
          </button>
        )
      },
      cell: ({ row }: any) => <ScoreBadge score={row.getValue("waveScore")} type="wave" />,
    },
    {
      accessorKey: "roic",
      header: ({ column }: any) => (
        <button className="flex items-center gap-1 hover:text-indigo-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          ROIC <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }: any) => {
        const v = row.getValue("roic") as number | undefined;
        if (v == null) return <span className="text-xs text-muted-foreground">—</span>;
        const pct = (v * 100).toFixed(1);
        const color = v >= 0.15 ? "text-emerald-400" : v >= 0.08 ? "text-yellow-400" : "text-red-400";
        return <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>;
      },
    },
    {
      accessorKey: "revenueGrowth1y",
      header: ({ column }: any) => (
        <button className="flex items-center gap-1 hover:text-indigo-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Rev Growth <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }: any) => {
        const v = row.getValue("revenueGrowth1y") as number | undefined;
        if (v == null) return <span className="text-xs text-muted-foreground">—</span>;
        const pct = (v * 100).toFixed(1);
        const color = v >= 0.15 ? "text-emerald-400" : v >= 0.05 ? "text-yellow-400" : "text-red-400";
        return <span className={`text-xs font-mono font-semibold ${color}`}>{v >= 0 ? "+" : ""}{pct}%</span>;
      },
    },
    {
      accessorKey: "fcfYield",
      header: ({ column }: any) => (
        <button className="flex items-center gap-1 hover:text-indigo-400 transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          FCF Yield <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }: any) => {
        const v = row.getValue("fcfYield") as number | undefined;
        if (v == null) return <span className="text-xs text-muted-foreground">—</span>;
        const pct = (v * 100).toFixed(1);
        const color = v >= 0.04 ? "text-emerald-400" : v >= 0.02 ? "text-yellow-400" : "text-red-400";
        return <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>;
      },
    },
    {
      accessorKey: "verdict",
      header: "Verdict",
      cell: ({ row }: any) => {
        const v = (row.getValue("verdict") as string | undefined) ?? "";
        if (!v) return <span className="text-xs text-muted-foreground">—</span>;

        const up = v.toUpperCase();
        let colors = "bg-secondary/50 text-muted-foreground border-border/50";
        if (up === "STRONG BUY") colors = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
        else if (up === "BUY")   colors = "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
        else if (up === "ADD")   colors = "bg-teal-500/10 text-teal-400 border-teal-500/20";
        else if (up === "HOLD")  colors = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        else if (up === "TRIM")  colors = "bg-orange-500/10 text-orange-400 border-orange-500/20";
        else if (up === "SELL")  colors = "bg-red-500/15 text-red-400 border-red-500/25";

        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors}`}>
            {v}
          </span>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-secondary/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-border rounded-xl bg-card/30">
        <p className="text-muted-foreground">No companies found for this view.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/20">
        <Table>
          <TableHeader className="bg-secondary/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-medium text-muted-foreground h-10">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border hover:bg-secondary/40 cursor-pointer transition-colors group"
                  onClick={() => setSelectedTicker(row.original.ticker)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CompanyDrawer 
        ticker={selectedTicker} 
        open={!!selectedTicker} 
        onOpenChange={(open) => !open && setSelectedTicker(null)} 
      />
    </>
  );
}
