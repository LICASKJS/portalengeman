import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

// normaliza texto
const norm = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const categoriaRaw = searchParams.get("categoria") || "";
  const categoria = norm(categoriaRaw);

  const filePath = path.join(process.cwd(), "public", "CLAF.xlsx");
  if (!fs.existsSync(filePath)) return NextResponse.json({ categoria: categoriaRaw, docs: [] });
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

  const pick = (o: any, ...cands: string[]) => {
    const map: Record<string, any> = {};
    for (const [k, v] of Object.entries(o)) map[norm(k)] = v;
    for (const c of cands) { const v = map[norm(c)]; if (v !== undefined) return v; }
    return "";
  };
  const TRUE = new Set(["S","SIM","OBRIGATORIO","YES","Y","1","TRUE"]);

  const docs = rows
    .filter(row => norm(pick(row,"categoria","classe","claf","grupo","tipo")) === categoria)
    .map(row => {
      const titulo = pick(row, "documento","titulo","descricao","doc");
      if (!titulo) return null;
      const obrig = TRUE.has(norm(pick(row,"obrigatorio","obg","mandatory","exigido")));
      const id = norm(titulo).replace(/[^A-Z0-9]+/g,"_").toLowerCase();
      return { id, titulo, obrigatorio: obrig };
    })
    .filter(Boolean);

  return NextResponse.json({ categoria: categoriaRaw, docs });
}
