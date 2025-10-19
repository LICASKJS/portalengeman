import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get("cnpj") || "";

  // TODO: buscar em DB/ERP/Bot Telegram
  // Exemplo estático:
  return NextResponse.json({
    cnpj,
    mediaIQF: 82.4,
    homologacao: 91.2,
    feedback: "Atendimento ágil; pontualidade recuperada; revisar apólice e ANTT."
  });
}

