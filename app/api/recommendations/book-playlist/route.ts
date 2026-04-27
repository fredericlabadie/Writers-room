import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { recommendBooksFromPlaylist, recommendPlaylistFromBook } from "@/lib/recommendations/bookPlaylist";
import { fetchPlaylistListeningDigest } from "@/lib/spotify";
import { NextResponse } from "next/server";

type Mode = "book_to_playlist" | "playlist_to_book";

// POST /api/recommendations/book-playlist
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  let body: {
    mode?: Mode;
    bookTitle?: string;
    bookAuthor?: string;
    bookNotes?: string;
    spotifyPlaylistUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode;
  if (mode !== "book_to_playlist" && mode !== "playlist_to_book") {
    return NextResponse.json({ error: "mode must be book_to_playlist or playlist_to_book" }, { status: 400 });
  }

  try {
    if (mode === "book_to_playlist") {
      const bookTitle = body.bookTitle?.trim() ?? "";
      const bookAuthor = body.bookAuthor?.trim() ?? "";
      if (!bookTitle || !bookAuthor) {
        return NextResponse.json({ error: "bookTitle and bookAuthor are required" }, { status: 400 });
      }
      const result = await recommendPlaylistFromBook({
        bookTitle,
        bookAuthor,
        bookNotes: body.bookNotes?.trim(),
      });
      return NextResponse.json({ mode, result });
    }

    const url = body.spotifyPlaylistUrl?.trim() ?? "";
    if (!url) {
      return NextResponse.json({ error: "spotifyPlaylistUrl is required" }, { status: 400 });
    }
    const digest = await fetchPlaylistListeningDigest(url);
    const result = await recommendBooksFromPlaylist(digest);
    return NextResponse.json({ mode, digest, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
