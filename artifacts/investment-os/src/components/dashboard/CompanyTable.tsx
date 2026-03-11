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
      accessorKey: "verdict",
      header: "AI Verdict",
      cell: ({ row }: any) => {
        const v = row.getValue("verdict") as string;
        if (!v) return <span className="text-xs text-muted-foreground">-</span>;
        
        let colors = "bg-secondary text-muted-foreground";
        if (v.toUpperCase().includes("BUY")) colors = "bg-success/10 text-success border-success/20";
        if (v.toUpperCase().includes("SELL")) colors = "bg-destructive/10 text-destructive border-destructive/20";
        if (v.toUpperCase().includes("HOLD")) colors = "bg-warning/10 text-warning border-warning/20";

        return (
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${colors}`}>
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
