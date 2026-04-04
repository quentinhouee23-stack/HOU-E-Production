// @ts-nocheck
import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const dynamic = "force-dynamic";

// 🟢 L'ALGORITHME QUI CONTOURNE GOOGLE ET ASPIRE LA VRAIE IMAGE
async function fetchArticleImage(googleNewsUrl) {
  try {
    // 1. On va sur la page de redirection Google News
    const redirectRes = await fetch(googleNewsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000) // On limite le temps pour ne pas bloquer ton site
    });
    const redirectHtml = await redirectRes.text();

    // 2. On craque le code pour trouver le VRAI lien de l'article
    let realUrl = null;
    const metaRefreshMatch = redirectHtml.match(/url=([^"]+)/i);
    
    if (metaRefreshMatch && metaRefreshMatch[1] && metaRefreshMatch[1].startsWith('http')) {
      realUrl = metaRefreshMatch[1];
    } else {
      const aHrefMatch = redirectHtml.match(/<a[^>]+href="([^"]+)"/i);
      if (aHrefMatch && aHrefMatch[1]) {
        realUrl = aHrefMatch[1];
      } else {
        realUrl = googleNewsUrl;
      }
    }

    // On nettoie le lien
    realUrl = realUrl.replace(/&amp;/g, '&');

    // 3. On va sur le VRAI site (ex: Radio France) en se faisant passer pour Chrome
    const articleRes = await fetch(realUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(4000)
    });
    
    const articleHtml = await articleRes.text();

    // 4. On extrait la balise officielle de l'image de couverture (og:image ou twitter:image)
    const og1 = articleHtml.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i);
    const og2 = articleHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    
    let imageUrl = (og1 && og1[1]) || (og2 && og2[1]);

    if (imageUrl) {
      // Si l'image commence par "/", on rajoute le nom du site devant
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(realUrl);
        imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
      }
      
      // 🟢 ANTI-LOGO GOOGLE : Si c'est encore une image Google, on la détruit
      if (imageUrl.includes('gstatic.com') || imageUrl.includes('googleusercontent.com') || imageUrl.includes('news.google.com')) {
        return null;
      }
      
      return imageUrl; // On renvoie la VRAIE image !
    }
    
    return null; // Si le site a bloqué, on renvoie null (le frontend mettra la belle image de secours)
  } catch (e) {
    return null;
  }
}

export async function GET() {
  try {
    const parser = new Parser();
    
    // On interroge le flux RSS
    const feed = await parser.parseURL('https://news.google.com/rss/search?q=musique+OR+rap+francais+OR+album+OR+concert+when:1d&hl=fr&gl=FR&ceid=FR:fr');

    const rawItems = feed.items.slice(0, 8);

    // On traite les 8 articles EN MÊME TEMPS
    const newsPromises = rawItems.map(async (item) => {
      const titleParts = item.title?.split(" - ") || ["Actu Musique", "Source"];
      const source = titleParts.pop(); 
      const cleanTitle = titleParts.join(" - "); 
      const snippet = item.contentSnippet || "";

      // On lance notre extracteur d'image agressif
      let imageUrl = await fetchArticleImage(item.link);

      return {
        id: item.guid,
        title: cleanTitle,
        link: item.link,
        source: source || "Actu",
        date: item.pubDate,
        snippet: snippet,
        image: imageUrl // La vraie image est là
      };
    });

    const news = await Promise.all(newsPromises);
    
    return NextResponse.json({ news });
  } catch (error) {
    console.error("Erreur News API :", error);
    return NextResponse.json({ error: "Impossible de charger les actus" }, { status: 500 });
  }
}