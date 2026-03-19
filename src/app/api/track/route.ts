import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  try {
    // Le serveur va chercher la donnée sur Deezer (pas de blocage CORS ici !)
    const res = await fetch(`https://api.deezer.com/track/${id}`);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur API Track:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}