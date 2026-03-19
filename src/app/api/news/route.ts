// @ts-nocheck
import { NextResponse } from "next/server";
import Parser from "rss-parser";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const parser = new Parser();
    
    // On interroge Google News avec des mots-clés précis
    const feed = await parser.parseURL('https://news.google.com/rss/search?q=musique+OR+rap+francais+OR+album+OR+concert+when:1d&hl=fr&gl=FR&ceid=FR:fr');

    // On récupère les 8 actus les plus médiatisées avec leur résumé
    const news = feed.items.slice(0, 8).map(item => {
      const titleParts = item.title?.split(" - ") || ["Actu Musique", "Source"];
      const source = titleParts.pop(); 
      const cleanTitle = titleParts.join(" - "); 
      
      // 🟢 On récupère le résumé de l'article
      const snippet = item.contentSnippet || "";

      return {
        id: item.guid,
        title: cleanTitle,
        link: item.link,
        source: source || "Actu Musique",
        date: item.pubDate,
        snippet: snippet,
      };
    });

    return NextResponse.json({ news });
  } catch (error) {
    console.error("Erreur News API :", error);
    return NextResponse.json({ error: "Impossible de charger les actus" }, { status: 500 });
  }
}